package com.infiniteprinter;

import fi.dy.masa.litematica.data.DataManager;
import fi.dy.masa.litematica.schematic.placement.SchematicPlacement;
import fi.dy.masa.litematica.schematic.placement.SubRegionPlacement;
import fi.dy.masa.litematica.selection.Box;
import fi.dy.masa.litematica.world.SchematicWorldHandler;
import fi.dy.masa.litematica.world.WorldSchematic;
import fi.dy.masa.malilib.util.LayerRange;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.inventory.AbstractSignEditScreen;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.BlockPos;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;

import java.util.*;

public class PrinterEngine {
    private static final PrinterEngine INSTANCE = new PrinterEngine();

    private final List<BlockPos> breakQueue = new ArrayList<>();
    private final List<BlockPos> placeQueue = new ArrayList<>();
    private final List<BlockPos> adjustQueue = new ArrayList<>();
    private final List<Entity> entityQueue = new ArrayList<>();

    // Anti-spam cooldown map: position -> expiration tick
    private final Map<BlockPos, Long> placementCooldowns = new HashMap<>();
    private long currentTick = 0;
    private int scanCooldown = 0;

    // Scan candidate caps and bounds
    private static final int MAX_PLACE_CANDIDATES = 1024;
    private static final int MAX_BREAK_CANDIDATES = 256;
    private static final int MAX_ADJUST_CANDIDATES = 256;
    private static final int MAX_SPAWN_CANDIDATES = 32;

    private BlockPos lastScanPlayerPos = BlockPos.ZERO;
    private volatile boolean hasMoreBlocks = false;

    // Statistics
    private volatile int remainingToPlace = 0;
    private volatile int remainingToBreak = 0;
    private volatile int remainingToAdjust = 0;
    private volatile int remainingToSpawn = 0;
    private volatile int totalPlaced = 0;
    private volatile int totalBroken = 0;
    private volatile int totalAdjusted = 0;
    private volatile int totalSpawned = 0;

    public static PrinterEngine getInstance() {
        return INSTANCE;
    }

    public void onClientTick(Minecraft client) {
        currentTick++;
        PrinterConfig config = PrinterConfig.getInstance();

        if (!config.enabled || client.player == null || client.level == null || client.gameMode == null) {
            if (client.level != null) {
                RedstoneSafetyHelper.setBlockUpdateSuppression(client.level, false);
            }
            return;
        }

        // Auto-close any sign edit screen opened while printing so GUI never traps the player
        if (client.screen instanceof AbstractSignEditScreen) {
            client.setScreen(null);
        }

        // Apply Litematica update suppression to prevent client-side redstone glitches
        RedstoneSafetyHelper.setBlockUpdateSuppression(client.level, config.suppressRedstoneUpdates);

        // Periodically purge expired cooldowns
        if (placementCooldowns.size() > 600) {
            placementCooldowns.entrySet().removeIf(entry -> entry.getValue() < currentTick);
        }

        // Check lag watchdog: if client stuttered or server tick is overloaded, PAUSE for 2 seconds (40 ticks)
        if (LagWatchdog.getInstance().checkAndPause(client, config)) {
            return;
        }

        WorldSchematic schematicWorld = SchematicWorldHandler.getSchematicWorld();
        if (schematicWorld == null) {
            clearQueues();
            return;
        }

        List<SchematicPlacement> placements = DataManager.getSchematicPlacementManager().getAllSchematicsPlacements();
        if (placements == null || placements.isEmpty()) {
            clearQueues();
            return;
        }

        // Refill queues when empty, or when placeQueue is running low
        boolean queuesEmpty = breakQueue.isEmpty() && placeQueue.isEmpty() && adjustQueue.isEmpty();
        boolean queuesLow = placeQueue.size() < Math.max(48, config.blocksPerTick * 4);
        boolean playerMoved = client.player.blockPosition().distSqr(lastScanPlayerPos) > 100; // >10 blocks

        if (queuesEmpty || (scanCooldown <= 0 && (queuesLow || playerMoved))) {
            scanSchematic(client, schematicWorld, placements, config);
            scanCooldown = 4; // Fast 4-tick (0.2s) refill cooldown
        } else if (scanCooldown > 0) {
            scanCooldown--;
        }

        // 1. Process BlockState Adjustments (Repeaters, Comparators, Daylight, NoteBlocks)
        if (config.autoAdjustBlockState && !adjustQueue.isEmpty()) {
            int adjustsLeft = 4;
            Iterator<BlockPos> it = adjustQueue.iterator();
            while (it.hasNext() && adjustsLeft > 0) {
                BlockPos pos = it.next();
                it.remove();

                BlockState current = client.level.getBlockState(pos);
                BlockState target = schematicWorld.getBlockState(pos);

                if (BlockStateAdjuster.canAdjust(current, target)) {
                    if (BlockStateAdjuster.adjust(client, pos, current, target)) {
                        totalAdjusted++;
                        adjustsLeft--;
                    }
                }
            }
        }

        boolean canUseCommands = config.useCommands && client.player != null &&
            (client.player.isCreative() || client.hasSingleplayerServer() || config.forceCommands);

        // 2. Process Auto-Break (Genuine obstacles only)
        if (config.autoBreak && !breakQueue.isEmpty()) {
            int breaksLeft = config.breaksPerTick;
            Iterator<BlockPos> it = breakQueue.iterator();
            while (it.hasNext() && breaksLeft > 0) {
                BlockPos pos = it.next();
                it.remove();

                BlockState current = client.level.getBlockState(pos);
                if (!current.isAir() && BreakHelper.isBreakable(client.level, pos, current, client.player.isCreative())) {
                    if (canUseCommands) {
                        client.player.connection.sendCommand("setblock " + pos.getX() + " " + pos.getY() + " " + pos.getZ() + " minecraft:air replace");
                    } else {
                        BreakHelper.breakBlock(client, pos, current);
                    }
                    breaksLeft--;
                    totalBroken++;
                }
            }
        }

        // 3. Process Auto-Place with Sneaking, Dependency, Cooldown, and Anti-Spam Control
        if (!placeQueue.isEmpty()) {
            int placesLeft = config.blocksPerTick;
            int placedThisTick = 0;
            int redstonePlacedThisTick = 0;
            int directionalPlacedThisTick = 0;
            int maxRedstonePerTick = Math.max(4, config.blocksPerTick / 2);
            Iterator<BlockPos> it = placeQueue.iterator();

            while (it.hasNext() && placesLeft > 0) {
                BlockPos pos = it.next();

                // Check anti-spam cooldown: do not re-send placement if server is still processing
                Long cd = placementCooldowns.get(pos);
                if (cd != null && currentTick < cd) {
                    continue;
                }

                BlockState current = client.level.getBlockState(pos);
                BlockState target = schematicWorld.getBlockState(pos);

                // Already placed correctly by server or user
                if (current.equals(target) || (BlockVariantHelper.isSameOrVariant(current, target) && PlacementOrientation.isFacingCorrect(current, target))) {
                    it.remove();
                    continue;
                }

                // If commands are available, place with exact blockstate instantly (/setblock)!
                if (canUseCommands && !target.isAir()) {
                    boolean isRedstone = RedstoneSafetyHelper.isRedstonePowerComponent(target);
                    if (isRedstone && redstonePlacedThisTick >= maxRedstonePerTick) {
                        continue;
                    }

                    String stateStr = net.minecraft.commands.arguments.blocks.BlockStateParser.serialize(target);
                    client.player.connection.sendCommand("setblock " + pos.getX() + " " + pos.getY() + " " + pos.getZ() + " " + stateStr + " replace");

                    placementCooldowns.put(pos, currentTick + config.placementCooldownTicks);
                    it.remove();
                    placesLeft--;
                    placedThisTick++;
                    totalPlaced++;
                    if (isRedstone) {
                        redstonePlacedThisTick++;
                    }
                    continue;
                }

                // Verify that block CAN physically be placed right now (has support & neighbor face)
                if (!PlacementHelper.canPlace(client.level, pos, target, config.infiniteReach)) {
                    // Skip for now; will be placed once supporting blocks are built
                    continue;
                }

                // If directional component, limit to 1 per tick to avoid movement packet throttling on server!
                boolean isDirectional = PlacementOrientation.isDirectional(target);
                if (isDirectional && directionalPlacedThisTick >= 1) {
                    continue;
                }

                // If redstone component, limit per tick to prevent signal glitches
                boolean isRedstone = RedstoneSafetyHelper.isRedstonePowerComponent(target);
                if (isRedstone && redstonePlacedThisTick >= maxRedstonePerTick) {
                    continue;
                }

                if (!target.isAir() && (current.isAir() || current.canBeReplaced())) {
                    Item requiredItem = target.getBlock().asItem();
                    if (requiredItem == Items.AIR) {
                        it.remove();
                        continue;
                    }

                    boolean hasItem = InventoryHelper.selectOrProvideItem(client, requiredItem);
                    if (!hasItem) {
                        // Player lacks item in survival
                        continue;
                    }

                    BlockHitResult hitResult = PlacementHelper.calculateHitResult(client.level, pos, target);

                    // SNEAK during placement to prevent opening chests, hoppers, doors, or right-clicking signs!
                    boolean wasSneaking = client.player.isShiftKeyDown();
                    net.minecraft.world.entity.player.Input origInput = client.player.input != null ? client.player.input.keyPresses : null;
                    try {
                        client.player.setShiftKeyDown(true);
                        if (client.player.input != null) {
                            client.player.input.keyPresses = new net.minecraft.world.entity.player.Input(false, false, false, false, false, true, false);
                        }
                        client.player.connection.send(new net.minecraft.network.protocol.game.ServerboundPlayerInputPacket(
                            new net.minecraft.world.entity.player.Input(false, false, false, false, false, true, false)
                        ));

                        // If directional, orient player rotation and send one unthrottled packet
                        if (isDirectional) {
                            PlacementOrientation.applyPlacementRotation(client, target);
                        }

                        InteractionResult result = client.gameMode.useItemOn(client.player, InteractionHand.MAIN_HAND, hitResult);
                        client.player.swing(InteractionHand.MAIN_HAND);

                        // Set anti-spam cooldown for this position so we don't spam packets next tick
                        placementCooldowns.put(pos, currentTick + config.placementCooldownTicks);
                    } finally {
                        client.player.setShiftKeyDown(wasSneaking);
                        if (client.player.input != null && origInput != null) {
                            client.player.input.keyPresses = origInput;
                        }
                        if (!wasSneaking) {
                            client.player.connection.send(new net.minecraft.network.protocol.game.ServerboundPlayerInputPacket(
                                new net.minecraft.world.entity.player.Input(false, false, false, false, false, false, false)
                            ));
                        }
                    }

                    // Immediately post-adjust if placed block has cycleable state (e.g. repeater delay 2..4)
                    if (config.autoAdjustBlockState) {
                        BlockState placed = client.level.getBlockState(pos);
                        if (BlockStateAdjuster.canAdjust(placed, target)) {
                            BlockStateAdjuster.adjust(client, pos, placed, target);
                        }
                    }

                    if (isDirectional) {
                        directionalPlacedThisTick++;
                    }
                    if (isRedstone) {
                        redstonePlacedThisTick++;
                    }

                    it.remove();
                    placesLeft--;
                    placedThisTick++;
                    totalPlaced++;
                }
            }

            if (placedThisTick == 0 && !placeQueue.isEmpty()) {
                // If all candidate blocks in queue are unplaceable right now, force rescan next tick
                scanCooldown = 0;
            }
        }

        // 4. Process Auto-Spawn Mobs / Entities
        if (config.autoSpawnMobs && !entityQueue.isEmpty()) {
            int spawnsLeft = Math.min(1, config.blocksPerTick);
            Iterator<Entity> it = entityQueue.iterator();
            while (it.hasNext() && spawnsLeft > 0) {
                Entity entity = it.next();
                it.remove();

                if (!EntitySpawnHelper.isEntityAlreadySpawned(client.level, entity)) {
                    if (EntitySpawnHelper.spawnEntity(client, entity, canUseCommands)) {
                        totalSpawned++;
                        spawnsLeft--;
                    }
                }
            }
        }

        remainingToBreak = breakQueue.size();
        remainingToPlace = placeQueue.size();
        remainingToAdjust = adjustQueue.size();
        remainingToSpawn = entityQueue.size();
    }

    private static class PlaceTask {
        final BlockPos pos;
        final int stage;
        final int y;
        final double distSq;

        PlaceTask(BlockPos pos, int stage, int y, double distSq) {
            this.pos = pos;
            this.stage = stage;
            this.y = y;
            this.distSq = distSq;
        }
    }

    private static class SubBoxBounds {
        final int minX, maxX, minY, maxY, minZ, maxZ;

        SubBoxBounds(int minX, int maxX, int minY, int maxY, int minZ, int maxZ) {
            this.minX = minX;
            this.maxX = maxX;
            this.minY = minY;
            this.maxY = maxY;
            this.minZ = minZ;
            this.maxZ = maxZ;
        }

        boolean intersectsChunk(int cx, int cz) {
            int chunkMinX = cx << 4;
            int chunkMaxX = chunkMinX + 15;
            int chunkMinZ = cz << 4;
            int chunkMaxZ = chunkMinZ + 15;
            return this.maxX >= chunkMinX && this.minX <= chunkMaxX &&
                   this.maxZ >= chunkMinZ && this.minZ <= chunkMaxZ;
        }
    }

    private void clearQueues() {
        breakQueue.clear();
        placeQueue.clear();
        adjustQueue.clear();
        entityQueue.clear();
        remainingToPlace = 0;
        remainingToBreak = 0;
        remainingToAdjust = 0;
        remainingToSpawn = 0;
        hasMoreBlocks = false;
        lastScanPlayerPos = BlockPos.ZERO;
    }

    private void scanSchematic(Minecraft client, WorldSchematic schematicWorld, List<SchematicPlacement> placements, PrinterConfig config) {
        LocalPlayer player = client.player;
        ClientLevel world = client.level;
        if (player == null || world == null) return;

        BlockPos playerPos = player.blockPosition();
        this.lastScanPlayerPos = playerPos;
        double reachSq = config.reachDistance * config.reachDistance;
        LayerRange layerRange = config.respectLayerRange ? DataManager.getRenderLayerRange() : null;

        // 1. Gather all active sub-region bounding boxes, clamped to reach distance
        List<SubBoxBounds> activeBoxes = new ArrayList<>();
        for (SchematicPlacement placement : placements) {
            if (!placement.isEnabled()) continue;

            Map<String, Box> boxes = placement.getSubRegionBoxes(SubRegionPlacement.RequiredEnabled.PLACEMENT_ENABLED);
            if (boxes == null || boxes.isEmpty()) continue;

            for (Box box : boxes.values()) {
                BlockPos p1 = box.getPos1();
                BlockPos p2 = box.getPos2();

                int minX = Math.min(p1.getX(), p2.getX());
                int maxX = Math.max(p1.getX(), p2.getX());
                int minY = Math.min(p1.getY(), p2.getY());
                int maxY = Math.max(p1.getY(), p2.getY());
                int minZ = Math.min(p1.getZ(), p2.getZ());
                int maxZ = Math.max(p1.getZ(), p2.getZ());

                if (!config.infiniteReach) {
                    minX = Math.max(minX, (int) Math.floor(playerPos.getX() - config.reachDistance));
                    maxX = Math.min(maxX, (int) Math.ceil(playerPos.getX() + config.reachDistance));
                    minY = Math.max(minY, (int) Math.floor(playerPos.getY() - config.reachDistance));
                    maxY = Math.min(maxY, (int) Math.ceil(playerPos.getY() + config.reachDistance));
                    minZ = Math.max(minZ, (int) Math.floor(playerPos.getZ() - config.reachDistance));
                    maxZ = Math.min(maxZ, (int) Math.ceil(playerPos.getZ() + config.reachDistance));
                }

                if (minX <= maxX && minY <= maxY && minZ <= maxZ) {
                    activeBoxes.add(new SubBoxBounds(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
        }

        if (activeBoxes.isEmpty()) {
            clearQueues();
            return;
        }

        // 2. Scan entities if needed (capped to prevent lag)
        if (config.autoSpawnMobs && entityQueue.size() < 8) {
            entityQueue.clear();
            for (SubBoxBounds box : activeBoxes) {
                if (entityQueue.size() >= MAX_SPAWN_CANDIDATES) break;
                AABB regionBox = new AABB(box.minX, box.minY, box.minZ, box.maxX + 1.0, box.maxY + 1.0, box.maxZ + 1.0);
                List<Entity> schematicEntities = schematicWorld.getEntities(
                    (Entity) null,
                    regionBox,
                    e -> !(e instanceof net.minecraft.world.entity.player.Player)
                );
                for (Entity entity : schematicEntities) {
                    if (entityQueue.size() >= MAX_SPAWN_CANDIDATES) break;
                    if (!config.infiniteReach && entity.distanceToSqr(player) > reachSq) continue;
                    if (!EntitySpawnHelper.isEntityAlreadySpawned(world, entity)) {
                        entityQueue.add(entity);
                    }
                }
            }
            if (!entityQueue.isEmpty()) {
                entityQueue.sort(Comparator.comparingDouble(e -> e.distanceToSqr(player)));
            }
        }

        // 3. Clear queues and scan blocks in concentric rings outward from player's chunk
        breakQueue.clear();
        placeQueue.clear();
        adjustQueue.clear();

        List<PlaceTask> placeTasks = new ArrayList<>(MAX_PLACE_CANDIDATES);
        Set<BlockPos> queued = new HashSet<>();
        BlockPos.MutableBlockPos mpos = new BlockPos.MutableBlockPos();

        int pcx = playerPos.getX() >> 4;
        int pcz = playerPos.getZ() >> 4;
        int maxChunkRadius = config.infiniteReach ? 16 : Math.max(1, (int) Math.min(24, Math.ceil(config.reachDistance / 16.0)));
        long maxEndTime = System.nanoTime() + 15_000_000L; // 15.0 ms maximum time budget
        boolean reachedBudget = false;

        ringLoop:
        for (int r = 0; r <= maxChunkRadius; r++) {
            if (r == 0) {
                if (scanChunk(client, schematicWorld, world, activeBoxes, pcx, pcz, player, playerPos, reachSq, layerRange, config, mpos, placeTasks, queued, maxEndTime)) {
                    reachedBudget = true;
                    break ringLoop;
                }
            } else {
                for (int dx = -r; dx <= r; dx++) {
                    if (scanChunk(client, schematicWorld, world, activeBoxes, pcx + dx, pcz - r, player, playerPos, reachSq, layerRange, config, mpos, placeTasks, queued, maxEndTime) ||
                        scanChunk(client, schematicWorld, world, activeBoxes, pcx + dx, pcz + r, player, playerPos, reachSq, layerRange, config, mpos, placeTasks, queued, maxEndTime)) {
                        reachedBudget = true;
                        break ringLoop;
                    }
                }
                for (int dz = -r + 1; dz <= r - 1; dz++) {
                    if (scanChunk(client, schematicWorld, world, activeBoxes, pcx - r, pcz + dz, player, playerPos, reachSq, layerRange, config, mpos, placeTasks, queued, maxEndTime) ||
                        scanChunk(client, schematicWorld, world, activeBoxes, pcx + r, pcz + dz, player, playerPos, reachSq, layerRange, config, mpos, placeTasks, queued, maxEndTime)) {
                        reachedBudget = true;
                        break ringLoop;
                    }
                }
            }
        }

        this.hasMoreBlocks = reachedBudget || placeTasks.size() >= MAX_PLACE_CANDIDATES;

        // 4. Ultra-fast sort on candidate place tasks (Zero world queries during sort!)
        placeTasks.sort((a, b) -> {
            if (config.redstoneSafeOrder && a.stage != b.stage) {
                return Integer.compare(a.stage, b.stage);
            }
            if (config.bottomToTop && a.y != b.y) {
                return Integer.compare(a.y, b.y);
            }
            return Double.compare(a.distSq, b.distSq);
        });

        for (PlaceTask task : placeTasks) {
            placeQueue.add(task.pos);
        }

        breakQueue.sort(Comparator.comparingDouble(p -> p.distSqr(playerPos)));
        adjustQueue.sort(Comparator.comparingDouble(p -> p.distSqr(playerPos)));

        remainingToBreak = breakQueue.size();
        remainingToPlace = placeQueue.size();
        remainingToAdjust = adjustQueue.size();
        remainingToSpawn = entityQueue.size();
    }

    private boolean scanChunk(Minecraft client, WorldSchematic schematicWorld, ClientLevel world,
                              List<SubBoxBounds> boxes, int cx, int cz, LocalPlayer player,
                              BlockPos playerPos, double reachSq, LayerRange layerRange,
                              PrinterConfig config, BlockPos.MutableBlockPos mpos,
                              List<PlaceTask> placeTasks, Set<BlockPos> queued,
                              long maxEndTime) {
        if (!world.getChunkSource().hasChunk(cx, cz)) {
            return false;
        }

        int chunkMinX = cx << 4;
        int chunkMaxX = chunkMinX + 15;
        int chunkMinZ = cz << 4;
        int chunkMaxZ = chunkMinZ + 15;

        for (SubBoxBounds box : boxes) {
            if (!box.intersectsChunk(cx, cz)) {
                continue;
            }

            int startX = Math.max(chunkMinX, box.minX);
            int endX = Math.min(chunkMaxX, box.maxX);
            int startZ = Math.max(chunkMinZ, box.minZ);
            int endZ = Math.min(chunkMaxZ, box.maxZ);
            int startY = box.minY;
            int endY = box.maxY;

            for (int y = startY; y <= endY; y++) {
                for (int x = startX; x <= endX; x++) {
                    for (int z = startZ; z <= endZ; z++) {
                        mpos.set(x, y, z);

                        if (layerRange != null && !layerRange.isPositionWithinRange(mpos)) {
                            continue;
                        }

                        double distSq = mpos.distSqr(playerPos);
                        if (!config.infiniteReach && distSq > reachSq) {
                            continue;
                        }

                        BlockState targetState = schematicWorld.getBlockState(mpos);
                        BlockState currentState = world.getBlockState(mpos);

                        if (currentState.equals(targetState)) {
                            continue;
                        }

                        // Case 1: Target is AIR in schematic, world has an extra block: DELETE IT!
                        if (targetState.isAir()) {
                            if (!currentState.isAir() && config.autoBreak && breakQueue.size() < MAX_BREAK_CANDIDATES) {
                                if (BreakHelper.isBreakable(world, mpos, currentState, player.isCreative())) {
                                    BlockPos immutablePos = mpos.immutable();
                                    if (queued.add(immutablePos)) {
                                        breakQueue.add(immutablePos);
                                    }
                                }
                            }
                            continue;
                        }

                        // Case 2: Target wants a block, and world has matching block or variant:
                        if (!currentState.isAir() && (currentState.is(targetState.getBlock()) || BlockVariantHelper.isSameOrVariant(currentState, targetState))) {
                            if (PlacementOrientation.isFacingCorrect(currentState, targetState)) {
                                if (config.autoAdjustBlockState && adjustQueue.size() < MAX_ADJUST_CANDIDATES && BlockStateAdjuster.canAdjust(currentState, targetState)) {
                                    BlockPos immutablePos = mpos.immutable();
                                    if (queued.add(immutablePos)) {
                                        adjustQueue.add(immutablePos);
                                    }
                                }
                            } else {
                                if (config.autoBreak && breakQueue.size() < MAX_BREAK_CANDIDATES && BreakHelper.isBreakable(world, mpos, currentState, player.isCreative())) {
                                    BlockPos immutablePos = mpos.immutable();
                                    if (queued.add(immutablePos)) {
                                        breakQueue.add(immutablePos);
                                    }
                                }
                            }
                            continue;
                        }

                        // Case 3: Target wants a block, but world has an obstacle (completely wrong block):
                        if (!currentState.isAir() && !currentState.canBeReplaced()) {
                            if (config.autoBreak && breakQueue.size() < MAX_BREAK_CANDIDATES && BreakHelper.isBreakable(world, mpos, currentState, player.isCreative())) {
                                BlockPos immutablePos = mpos.immutable();
                                if (queued.add(immutablePos)) {
                                    breakQueue.add(immutablePos);
                                }
                            }
                            continue;
                        }

                        // Case 4: World position is air or replaceable: ready to place!
                        if (currentState.isAir() || currentState.canBeReplaced()) {
                            if (placeTasks.size() < MAX_PLACE_CANDIDATES) {
                                BlockPos immutablePos = mpos.immutable();
                                if (queued.add(immutablePos)) {
                                    int stage = RedstoneSafetyHelper.getPlacementStage(targetState);
                                    placeTasks.add(new PlaceTask(immutablePos, stage, y, distSq));
                                }
                            }
                        }

                        if (placeTasks.size() >= MAX_PLACE_CANDIDATES &&
                            breakQueue.size() >= MAX_BREAK_CANDIDATES &&
                            adjustQueue.size() >= MAX_ADJUST_CANDIDATES) {
                            return true;
                        }
                    }
                }
            }
        }

        return placeTasks.size() >= MAX_PLACE_CANDIDATES || System.nanoTime() > maxEndTime;
    }

    public int getRemainingToPlace() {
        return remainingToPlace;
    }

    public int getRemainingToBreak() {
        return remainingToBreak;
    }

    public int getRemainingToAdjust() {
        return remainingToAdjust;
    }

    public int getRemainingToSpawn() {
        return remainingToSpawn;
    }

    public int getTotalPlaced() {
        return totalPlaced;
    }

    public int getTotalBroken() {
        return totalBroken;
    }

    public int getTotalAdjusted() {
        return totalAdjusted;
    }

    public int getTotalSpawned() {
        return totalSpawned;
    }

    public boolean hasMoreBlocks() {
        return hasMoreBlocks;
    }

    public void resetStats() {
        totalPlaced = 0;
        totalBroken = 0;
        totalAdjusted = 0;
        totalSpawned = 0;
        placementCooldowns.clear();
        LagWatchdog.getInstance().reset();
    }
}
