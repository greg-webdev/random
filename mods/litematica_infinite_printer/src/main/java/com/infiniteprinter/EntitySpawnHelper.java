package com.infiniteprinter;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.resources.Identifier;
import net.minecraft.util.ProblemReporter;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraft.world.level.storage.TagValueOutput;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;

import java.util.List;
import java.util.Locale;

public class EntitySpawnHelper {

    /**
     * Checks whether an entity of the same type is already present in the target world near this position.
     * Prevents spawning duplicate entities!
     */
    public static boolean isEntityAlreadySpawned(ClientLevel world, Entity schematicEntity) {
        if (world == null || schematicEntity == null) return true;

        // Check within a 0.8 block radius around the entity
        AABB checkArea = schematicEntity.getBoundingBox().inflate(0.8);
        List<Entity> existing = world.getEntities(
            (Entity) null,
            checkArea,
            e -> e.getType() == schematicEntity.getType() && e.isAlive() && !(e instanceof Player)
        );

        return !existing.isEmpty();
    }

    /**
     * Attempts to spawn the entity into the world:
     * - In Command mode: executes /summon with exact position, rotation, and NBT
     * - In Survival mode: uses spawn eggs or item placement (Armor Stand, Item Frame, Boat, Minecart)
     */
    public static boolean spawnEntity(Minecraft client, Entity schematicEntity, boolean canUseCommands) {
        if (client.player == null || schematicEntity == null) return false;

        EntityType<?> type = schematicEntity.getType();
        Identifier typeId = BuiltInRegistries.ENTITY_TYPE.getKey(type);
        if (typeId == null) return false;

        double x = schematicEntity.getX();
        double y = schematicEntity.getY();
        double z = schematicEntity.getZ();
        float yaw = schematicEntity.getYRot();
        float pitch = schematicEntity.getXRot();

        if (canUseCommands) {
            CompoundTag tag = extractEntityNbt(schematicEntity);
            String nbtString = "";
            if (tag != null && !tag.isEmpty()) {
                tag.remove("UUID");
                tag.remove("Pos");
                tag.remove("Motion");
                nbtString = " " + tag.toString();
            } else {
                nbtString = String.format(Locale.ROOT, " {Rotation:[%.2ff,%.2ff]}", yaw, pitch);
            }

            String cmd = String.format(Locale.ROOT, "summon %s %.3f %.3f %.3f%s", typeId.toString(), x, y, z, nbtString);
            client.player.connection.sendCommand(cmd);
            return true;
        }

        // Survival / Packet fallback:
        Item spawnItem = getSpawnItem(schematicEntity);
        if (spawnItem == null) {
            return false;
        }

        boolean hasItem = InventoryHelper.selectOrProvideItem(client, spawnItem);
        if (!hasItem) {
            return false;
        }

        BlockPos blockPos = BlockPos.containing(x, y, z);
        BlockPos supportPos = blockPos.below();
        BlockHitResult hitResult = new BlockHitResult(
            new Vec3(x, supportPos.getY() + 1.0, z),
            Direction.UP,
            supportPos,
            false
        );

        client.gameMode.useItemOn(client.player, InteractionHand.MAIN_HAND, hitResult);
        client.player.swing(InteractionHand.MAIN_HAND);
        return true;
    }

    private static CompoundTag extractEntityNbt(Entity entity) {
        try {
            TagValueOutput output = TagValueOutput.createWithoutContext(ProblemReporter.DISCARDING);
            entity.saveWithoutId(output);
            return output.buildResult();
        } catch (Throwable t) {
            return new CompoundTag();
        }
    }

    public static Item getSpawnItem(Entity entity) {
        EntityType<?> type = entity.getType();

        // 1. Spawn Eggs for living mobs
        SpawnEggItem egg = SpawnEggItem.byId(type);
        if (egg != null) {
            return egg;
        }

        // 2. Non-mob entities
        if (type == EntityType.ARMOR_STAND) return Items.ARMOR_STAND;
        if (type == EntityType.ITEM_FRAME) return Items.ITEM_FRAME;
        if (type == EntityType.GLOW_ITEM_FRAME) return Items.GLOW_ITEM_FRAME;
        if (type == EntityType.PAINTING) return Items.PAINTING;
        if (type == EntityType.MINECART) return Items.MINECART;
        if (type == EntityType.CHEST_MINECART) return Items.CHEST_MINECART;
        if (type == EntityType.FURNACE_MINECART) return Items.FURNACE_MINECART;
        if (type == EntityType.HOPPER_MINECART) return Items.HOPPER_MINECART;
        if (type == EntityType.TNT_MINECART) return Items.TNT_MINECART;
        if (type == EntityType.OAK_BOAT) return Items.OAK_BOAT;
        if (type == EntityType.END_CRYSTAL) return Items.END_CRYSTAL;

        return null;
    }
}
