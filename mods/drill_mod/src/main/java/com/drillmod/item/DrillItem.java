package com.drillmod.item;

import com.drillmod.DrillMod;
import com.drillmod.inventory.DrillStorage;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.TooltipDisplay;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.item.crafting.RecipeType;
import net.minecraft.world.item.crafting.SingleRecipeInput;
import net.minecraft.world.item.crafting.SmeltingRecipe;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.loot.LootParams;
import net.minecraft.world.level.storage.loot.parameters.LootContextParams;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

public class DrillItem extends Item {
	private static final Map<UUID, Long> ACTIVE_DRILLERS = new ConcurrentHashMap<>();

	public DrillItem(Item.Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		player.startUsingItem(hand);
		return InteractionResult.CONSUME;
	}

	@Override
	public ItemUseAnimation getUseAnimation(ItemStack stack) {
		return ItemUseAnimation.BOW;
	}

	@Override
	public int getUseDuration(ItemStack stack, LivingEntity entity) {
		return 72000;
	}

	@Override
	public void onUseTick(Level level, LivingEntity entity, ItemStack stack, int count) {
		if (!(entity instanceof Player player)) {
			return;
		}

		ACTIVE_DRILLERS.put(player.getUUID(), level.getGameTime());
		player.resetFallDistance();

		// Apply hidden infinite Night Vision while drilling (no particles, no HUD icon)
		if (!player.hasEffect(MobEffects.NIGHT_VISION)) {
			player.addEffect(new MobEffectInstance(MobEffects.NIGHT_VISION, MobEffectInstance.INFINITE_DURATION, 0, false, false, false));
		}

		// 1. Omnidirectional High-Speed Flight & Propulsion
		Vec3 look = player.getLookAngle();
		double speed = 0.58D; // Fast, smooth propulsion in any 3D direction
		Vec3 velocity = look.scale(speed);
		player.setDeltaMovement(velocity);
		player.hurtMarked = true;
		player.resetFallDistance();

		// 2. 3D Tunnel Excavation with Range Enchantment scaling
		if (level instanceof ServerLevel serverLevel && player instanceof ServerPlayer serverPlayer) {
			Vec3 eye = player.getEyePosition();

			// Range enchantment: each level is x1.25 the previous tier (up to 3 levels: level 1 = 1.25x, level 2 = 1.56x, level 3 = 1.95x)
			int rangeLevel = getRangeLevel(stack);
			double sizeMultiplier = (rangeLevel > 0) ? Math.pow(1.25D, Math.min(rangeLevel, 3)) : 1.0D;

			double tunnelRadius = 1.75D * sizeMultiplier;
			double radiusSq = tunnelRadius * tunnelRadius;
			double reach = 3.6D * sizeMultiplier;
			Vec3 reachEnd = eye.add(look.scale(reach));

			int smeltLevel = getSmeltLevel(stack);
			float smeltChance = Math.min(1.0f, smeltLevel * 0.10f); // 10% per level up to level 9 (90%)

			DrillStorage storage = DrillStorage.loadFromStack(stack, serverLevel.registryAccess());
			boolean brokeAny = false;

			int minX = (int) Math.floor(Math.min(eye.x, reachEnd.x) - (tunnelRadius + 0.5));
			int maxX = (int) Math.ceil(Math.max(eye.x, reachEnd.x) + (tunnelRadius + 0.5));
			int minY = (int) Math.floor(Math.min(eye.y, reachEnd.y) - (tunnelRadius + 0.5));
			int maxY = (int) Math.ceil(Math.max(eye.y, reachEnd.y) + (tunnelRadius + 0.5));
			int minZ = (int) Math.floor(Math.min(eye.z, reachEnd.z) - (tunnelRadius + 0.5));
			int maxZ = (int) Math.ceil(Math.max(eye.z, reachEnd.z) + (tunnelRadius + 0.5));

			minY = Math.max(minY, serverLevel.getMinY() + 1);
			maxY = Math.min(maxY, serverLevel.getMaxY());

			AABB playerBox = player.getBoundingBox().inflate(0.35 * sizeMultiplier);

			for (int x = minX; x <= maxX; x++) {
				for (int y = minY; y <= maxY; y++) {
					for (int z = minZ; z <= maxZ; z++) {
						double bx = x + 0.5;
						double by = y + 0.5;
						double bz = z + 0.5;

						double wx = bx - eye.x;
						double wy = by - eye.y;
						double wz = bz - eye.z;

						// Project onto look vector
						double t = wx * look.x + wy * look.y + wz * look.z;
						boolean shouldMine = false;

						// Cylinder around look ray
						if (t >= 0.3 && t <= reach + 0.6) {
							double distSq = (wx * wx + wy * wy + wz * wz) - (t * t);
							if (distSq <= radiusSq) {
								shouldMine = true;
							}
						}

						// Immediate player clearance to prevent getting snagged
						if (!shouldMine && playerBox.contains(bx, by, bz)) {
							shouldMine = true;
						}

						if (shouldMine) {
							BlockPos digPos = new BlockPos(x, y, z);
							BlockState state = serverLevel.getBlockState(digPos);

							if (state.isAir() || state.getDestroySpeed(serverLevel, digPos) < 0) {
								// Bedrock and unbreakable blocks are skipped
								continue;
							}

							// Collect drops with loot params
							LootParams.Builder params = new LootParams.Builder(serverLevel)
								.withParameter(LootContextParams.ORIGIN, Vec3.atCenterOf(digPos))
								.withParameter(LootContextParams.TOOL, stack)
								.withOptionalParameter(LootContextParams.THIS_ENTITY, serverPlayer)
								.withOptionalParameter(LootContextParams.BLOCK_ENTITY, serverLevel.getBlockEntity(digPos));
							List<ItemStack> drops = state.getDrops(params);

							// Apply custom 'smelt' enchantment chance
							for (ItemStack drop : drops) {
								if (!drop.isEmpty()) {
									if (smeltChance > 0 && serverLevel.random.nextFloat() < smeltChance) {
										SingleRecipeInput input = new SingleRecipeInput(drop);
										Optional<RecipeHolder<SmeltingRecipe>> recipe = serverLevel.getServer().getRecipeManager().getRecipeFor(RecipeType.SMELTING, input, serverLevel);
										if (recipe.isPresent()) {
											ItemStack smelted = recipe.get().value().assemble(input, serverLevel.registryAccess());
											if (!smelted.isEmpty()) {
												int countTotal = smelted.getCount() * drop.getCount();
												drop = smelted.copyWithCount(countTotal);
												serverLevel.sendParticles(ParticleTypes.FLAME, bx, by, bz, 3, 0.15, 0.15, 0.15, 0.04);
											}
										}
									}
									// Autocollect into infinite storage
									storage.addItem(drop);
								}
							}

							// Destroy block without ground drops (autocollected)
							serverLevel.destroyBlock(digPos, false, serverPlayer);
							serverLevel.sendParticles(ParticleTypes.CRIT, bx, by, bz, 2, 0.15, 0.15, 0.15, 0.05);
							brokeAny = true;
						}
					}
				}
			}

			if (brokeAny) {
				DrillStorage.saveToStack(stack, storage, serverLevel.registryAccess());
				boolean hadSaveDrill = hasSaveDrill(stack);
				if (hadSaveDrill) {
					com.drillmod.inventory.SavedDrillManager.saveBackup(serverLevel.getServer(), serverPlayer.getUUID(), storage);
				}
				// Damage drill durability only if NOT indestructible
				if (!hasIndestructible(stack)) {
					stack.hurtAndBreak(1, serverPlayer, player.getEquipmentSlotForItem(stack));
					if (stack.isEmpty() && hadSaveDrill) {
						serverPlayer.sendSystemMessage(net.minecraft.network.chat.Component.literal("§e[Drill Mod] Your drill broke! Because it had §6Save Drill§e, your inventory was saved. Press §b📂 Restore§e in a new drill or use §b/drill restore§e to restore your items!"));
					}
				}
			}

			// Audio & particles feedback
			if (count % 3 == 0) {
				Vec3 tip = eye.add(look.scale(1.6 * sizeMultiplier));
				serverLevel.sendParticles(ParticleTypes.CRIT, tip.x, tip.y, tip.z, 4 + rangeLevel * 2, 0.2 * sizeMultiplier, 0.2 * sizeMultiplier, 0.2 * sizeMultiplier, 0.1);
				serverLevel.sendParticles(ParticleTypes.SMOKE, tip.x, tip.y, tip.z, 2 + rangeLevel, 0.1 * sizeMultiplier, 0.1 * sizeMultiplier, 0.1 * sizeMultiplier, 0.05);
				serverLevel.playSound(null, player.blockPosition(), SoundEvents.GRINDSTONE_USE, SoundSource.PLAYERS, 0.8F, 1.3F);
				if (brokeAny) {
					serverLevel.playSound(null, player.blockPosition(), SoundEvents.NETHERITE_BLOCK_BREAK, SoundSource.BLOCKS, 0.6F, 1.0F);
				}
			}
		}
	}

	@Override
	public boolean releaseUsing(ItemStack stack, Level level, LivingEntity entity, int timeLeft) {
		return super.releaseUsing(stack, level, entity, timeLeft);
	}

	public static void tickDrillers(MinecraftServer server) {
		if (ACTIVE_DRILLERS.isEmpty()) return;
		long currentTime = server.overworld().getGameTime();
		ACTIVE_DRILLERS.entrySet().removeIf(entry -> {
			UUID uuid = entry.getKey();
			long lastDrillTick = entry.getValue();
			ServerPlayer player = server.getPlayerList().getPlayer(uuid);
			if (player == null) {
				return true;
			}
			// Remove night vision after exactly 3 seconds (60 ticks) of not drilling
			if (currentTime - lastDrillTick >= 60) {
				player.removeEffect(MobEffects.NIGHT_VISION);
				return true;
			}
			return false;
		});
	}

	public static boolean isDrilling(Player player) {
		if (player == null) return false;
		Long lastTick = ACTIVE_DRILLERS.get(player.getUUID());
		if (lastTick != null && player.level().getGameTime() - lastTick <= 5) {
			return true;
		}
		return player.isUsingItem() && (player.getMainHandItem().is(DrillMod.DRILL) || player.getOffhandItem().is(DrillMod.DRILL));
	}

	public static int getSmeltLevel(ItemStack stack) {
		if (stack.isEmpty()) return 0;
		for (var entry : stack.getEnchantments().entrySet()) {
			Holder<Enchantment> holder = entry.getKey();
			if (holder.is(DrillMod.SMELT_KEY) || holder.getRegisteredName().equals("drill_mod:smelt")) {
				return entry.getIntValue();
			}
		}
		return 0;
	}

	public static int getRangeLevel(ItemStack stack) {
		if (stack.isEmpty()) return 0;
		for (var entry : stack.getEnchantments().entrySet()) {
			Holder<Enchantment> holder = entry.getKey();
			if (holder.is(DrillMod.RANGE_KEY) || holder.getRegisteredName().equals("drill_mod:range")) {
				return entry.getIntValue();
			}
		}
		return 0;
	}

	public static boolean hasSaveDrill(ItemStack stack) {
		if (stack.isEmpty()) return false;
		for (var entry : stack.getEnchantments().entrySet()) {
			Holder<Enchantment> holder = entry.getKey();
			if (holder.is(DrillMod.SAVEDRILL_KEY) || holder.getRegisteredName().equals("drill_mod:savedrill")) {
				return true;
			}
		}
		return false;
	}

	public static boolean hasIndestructible(ItemStack stack) {
		if (stack.isEmpty()) return false;
		for (var entry : stack.getEnchantments().entrySet()) {
			Holder<Enchantment> holder = entry.getKey();
			if (holder.is(DrillMod.INDESTRUCTIBLE_KEY) || holder.getRegisteredName().equals("drill_mod:indestructible")) {
				return true;
			}
		}
		return false;
	}

	public static int getVisualDurability(ItemStack stack) {
		int maxDurability = stack.getMaxDamage();
		if (maxDurability <= 10) return maxDurability;
		long cycleTime = System.currentTimeMillis() % 20000L;
		if (cycleTime < 10000L) {
			// First 10 seconds: slowly fall from maxDurability down to 10
			double progress = (double) cycleTime / 10000.0;
			return (int) Math.round(maxDurability - progress * (maxDurability - 10));
		} else {
			// Next 10 seconds: slowly rise from 10 back up to maxDurability
			double progress = (double) (cycleTime - 10000L) / 10000.0;
			return (int) Math.round(10 + progress * (maxDurability - 10));
		}
	}

	public static int getVisualDamage(ItemStack stack) {
		int maxDurability = stack.getMaxDamage();
		return Math.max(0, maxDurability - getVisualDurability(stack));
	}

	@Override
	public boolean isBarVisible(ItemStack stack) {
		if (hasIndestructible(stack)) {
			return true;
		}
		return super.isBarVisible(stack);
	}

	@Override
	public int getBarWidth(ItemStack stack) {
		if (hasIndestructible(stack)) {
			float durability = getVisualDurability(stack);
			float max = stack.getMaxDamage();
			return Math.max(1, Math.round(13.0F * durability / max));
		}
		return super.getBarWidth(stack);
	}

	@Override
	public int getBarColor(ItemStack stack) {
		if (hasIndestructible(stack)) {
			float durability = getVisualDurability(stack);
			float max = stack.getMaxDamage();
			float fraction = Math.max(0.0F, durability / max);
			return net.minecraft.util.Mth.hsvToRgb(fraction / 3.0F, 1.0F, 1.0F);
		}
		return super.getBarColor(stack);
	}

	@Override
	public void appendHoverText(ItemStack stack, Item.TooltipContext context, TooltipDisplay display, Consumer<net.minecraft.network.chat.Component> tooltipAdder, TooltipFlag flag) {
		super.appendHoverText(stack, context, display, tooltipAdder, flag);
		if (hasIndestructible(stack)) {
			int durability = getVisualDurability(stack);
			tooltipAdder.accept(net.minecraft.network.chat.Component.literal("§d✦ Indestructible §7(Visual Durability: §e" + durability + "§7/§e" + stack.getMaxDamage() + "§7)"));
		}
	}
}
