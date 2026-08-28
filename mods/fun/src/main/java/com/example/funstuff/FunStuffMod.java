package com.example.funstuff;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.minecraft.core.Registry;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.phys.Vec3;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FunStuffMod implements ModInitializer {
	public static final String MOD_ID = "funstuff";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	public static final ResourceKey<CreativeModeTab> FUN_TAB_KEY = ResourceKey.create(
		Registries.CREATIVE_MODE_TAB,
		Identifier.fromNamespaceAndPath(MOD_ID, "fun_tab")
	);

	public static final CreativeModeTab FUN_TAB = FabricItemGroup.builder()
		.icon(() -> new ItemStack(ModItems.SLIME_LAUNCHER))
		.title(Component.translatable("itemGroup.funstuff.fun_tab"))
		.displayItems((params, output) -> {
			output.accept(ModItems.SLIME_LAUNCHER);
			output.accept(ModItems.BOUNCY_BOOTS);
			output.accept(ModItems.PARTY_POPPER);
			output.accept(ModItems.POCKET_BLACK_HOLE);
			output.accept(ModItems.POLYMORPH_WAND);
			output.accept(ModItems.RAINBOW_CHEESE);
			output.accept(ModItems.GRAPPLING_SLINGER);
			output.accept(ModItems.DISCO_BOMB);
			output.accept(ModItems.SCALE_RAY);
			output.accept(ModItems.THUNDER_HAMMER);
			output.accept(ModItems.RAINBOW_BLASTER);
			output.accept(ModBlocks.TRAMPOLINE_ITEM);
		})
		.build();

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing Fun Stuff Mod for Minecraft 1.21.11!");

		ModBlocks.initialize();
		ModItems.initialize();

		// Register Creative Inventory Tab
		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, FUN_TAB_KEY, FUN_TAB);

		// Event: Bouncy Boots fall damage absorption & automatic bounce
		ServerLivingEntityEvents.ALLOW_DAMAGE.register((entity, source, amount) -> {
			if (source.is(DamageTypeTags.IS_FALL)) {
				ItemStack feet = entity.getItemBySlot(EquipmentSlot.FEET);
				if (feet.is(ModItems.BOUNCY_BOOTS)) {
					double bounce = Math.min(2.2, 0.5 + (amount * 0.08));
					Vec3 delta = entity.getDeltaMovement();
					entity.setDeltaMovement(delta.x, bounce, delta.z);
					entity.hurtMarked = true;

					if (entity.level() instanceof ServerLevel serverLevel) {
						serverLevel.sendParticles(ParticleTypes.ITEM_SLIME, entity.getX(), entity.getY() + 0.1, entity.getZ(), 25, 0.3, 0.1, 0.3, 0.1);
						serverLevel.playSound(null, entity.getX(), entity.getY(), entity.getZ(), SoundEvents.SLIME_JUMP, SoundSource.PLAYERS, 1.2f, 1.2f);
					}
					return false; // Negate fall damage entirely
				}
			}
			return true;
		});

		LOGGER.info("Fun Stuff Mod successfully initialized!");
	}

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}
}
