/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.minecraft.core.BlockPos
 *  net.minecraft.core.Position
 *  net.minecraft.core.particles.ColorParticleOption
 *  net.minecraft.core.particles.ParticleOptions
 *  net.minecraft.core.particles.ParticleType
 *  net.minecraft.core.particles.ParticleTypes
 *  net.minecraft.server.level.ServerLevel
 *  net.minecraft.sounds.SoundSource
 *  net.minecraft.world.InteractionHand
 *  net.minecraft.world.InteractionResult
 *  net.minecraft.world.entity.LivingEntity
 *  net.minecraft.world.entity.player.Player
 *  net.minecraft.world.item.Item
 *  net.minecraft.world.item.Item$Properties
 *  net.minecraft.world.item.ItemStack
 *  net.minecraft.world.item.ItemUseAnimation
 *  net.minecraft.world.level.Level
 *  net.minecraft.world.level.block.state.BlockState
 *  net.minecraft.world.phys.AABB
 *  net.minecraft.world.phys.Vec3
 */
package com.laserweapons.item;

import com.laserweapons.sound.ModSounds;
import java.util.List;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Position;
import net.minecraft.core.particles.ColorParticleOption;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleType;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

public class MinigunItem
extends Item {
    public MinigunItem(Item.Properties properties) {
        super(properties);
    }

    public int getUseDuration(ItemStack stack, LivingEntity entity) {
        return 72000;
    }

    public ItemUseAnimation getUseAnimation(ItemStack stack) {
        return ItemUseAnimation.BOW;
    }

    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        player.startUsingItem(hand);
        return InteractionResult.CONSUME;
    }

    public void onUseTick(Level level, LivingEntity livingEntity, ItemStack stack, int remainingUseDuration) {
        if (level.isClientSide()) {
            return;
        }
        ServerLevel serverLevel = (ServerLevel)level;
        float pitch = 1.3f + serverLevel.random.nextFloat() * 0.4f;
        level.playSound(null, livingEntity.getX(), livingEntity.getY(), livingEntity.getZ(), ModSounds.GUN_SHOT, SoundSource.PLAYERS, 0.85f, pitch);
        Vec3 eyePos = livingEntity.getEyePosition();
        Vec3 look = livingEntity.getLookAngle();
        double spread = 0.035;
        double spreadX = (serverLevel.random.nextDouble() - 0.5) * spread;
        double spreadY = (serverLevel.random.nextDouble() - 0.5) * spread;
        double spreadZ = (serverLevel.random.nextDouble() - 0.5) * spread;
        Vec3 shootDir = look.add(spreadX, spreadY, spreadZ).normalize();
        Vec3 muzzle = eyePos.add(look.scale(0.85));
        serverLevel.sendParticles((ParticleOptions)ColorParticleOption.create((ParticleType)ParticleTypes.FLASH, (int)0xFFAA00), muzzle.x, muzzle.y, muzzle.z, 1, 0.0, 0.0, 0.0, 0.0);
        serverLevel.sendParticles((ParticleOptions)ParticleTypes.FLAME, muzzle.x, muzzle.y, muzzle.z, 2, 0.05, 0.05, 0.05, 0.05);
        Vec3 right = look.cross(new Vec3(0.0, 1.0, 0.0)).normalize();
        Vec3 ejectPos = eyePos.add(look.scale(0.3)).add(right.scale(0.3));
        serverLevel.sendParticles((ParticleOptions)ParticleTypes.SMOKE, ejectPos.x, ejectPos.y, ejectPos.z, 1, right.x * 0.1, 0.05, right.z * 0.1, 0.02);
        double maxDistance = 72.0;
        double step = 0.6;
        for (double d = 1.0; d <= maxDistance; d += step) {
            BlockPos bPos;
            BlockState state;
            Vec3 currentPos = eyePos.add(shootDir.scale(d));
            if ((int)(d / step) % 2 == 0) {
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.CRIT, currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.0);
            }
            if (!(state = level.getBlockState(bPos = BlockPos.containing((Position)currentPos))).isAir() && state.canOcclude()) {
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.POOF, currentPos.x, currentPos.y, currentPos.z, 3, 0.1, 0.1, 0.1, 0.05);
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.CRIT, currentPos.x, currentPos.y, currentPos.z, 4, 0.1, 0.1, 0.1, 0.1);
                break;
            }
            AABB box = new AABB(currentPos.x - 0.45, currentPos.y - 0.45, currentPos.z - 0.45, currentPos.x + 0.45, currentPos.y + 0.45, currentPos.z + 0.45);
            List<LivingEntity> targets = level.getEntitiesOfClass(LivingEntity.class, box, e -> e != livingEntity && e.isAlive());
            if (targets.isEmpty()) continue;
            for (LivingEntity target : targets) {
                target.invulnerableTime = 0;
                if (livingEntity instanceof Player) {
                    Player player = (Player)livingEntity;
                    target.hurtServer(serverLevel, player.damageSources().playerAttack(player), 12.0f);
                } else {
                    target.hurtServer(serverLevel, livingEntity.damageSources().mobAttack(livingEntity), 12.0f);
                }
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.DAMAGE_INDICATOR, target.getX(), target.getY() + (double)(target.getBbHeight() / 2.0f), target.getZ(), 2, 0.1, 0.1, 0.1, 0.1);
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.CRIT, target.getX(), target.getY() + (double)(target.getBbHeight() / 2.0f), target.getZ(), 5, 0.15, 0.15, 0.15, 0.1);
            }
            break;
        }
    }
}

