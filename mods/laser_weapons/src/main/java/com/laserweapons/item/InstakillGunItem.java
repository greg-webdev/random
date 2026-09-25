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
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

public class InstakillGunItem
extends Item {
    public InstakillGunItem(Item.Properties properties) {
        super(properties);
    }

    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        ItemStack held = player.getItemInHand(hand);
        if (level.isClientSide()) {
            return InteractionResult.SUCCESS;
        }
        ServerLevel serverLevel = (ServerLevel)level;
        level.playSound(null, player.getX(), player.getY(), player.getZ(), ModSounds.GUN_SHOT, SoundSource.PLAYERS, 1.0f, 1.0f);
        Vec3 eyePos = player.getEyePosition();
        Vec3 look = player.getLookAngle();
        double maxDistance = 128.0;
        double step = 0.5;
        Vec3 muzzle = eyePos.add(look.scale(0.8));
        serverLevel.sendParticles((ParticleOptions)ColorParticleOption.create((ParticleType)ParticleTypes.FLASH, (int)0xFFFFFF), muzzle.x, muzzle.y, muzzle.z, 1, 0.0, 0.0, 0.0, 0.0);
        serverLevel.sendParticles((ParticleOptions)ParticleTypes.SMOKE, muzzle.x, muzzle.y, muzzle.z, 4, 0.05, 0.05, 0.05, 0.02);
        for (double d = 1.0; d <= maxDistance; d += step) {
            BlockPos bPos;
            BlockState state;
            Vec3 currentPos = eyePos.add(look.scale(d));
            serverLevel.sendParticles((ParticleOptions)ParticleTypes.CRIT, currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.0);
            if ((int)(d / step) % 3 == 0) {
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.0);
            }
            if (!(state = level.getBlockState(bPos = BlockPos.containing((Position)currentPos))).isAir() && state.canOcclude()) {
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.EXPLOSION, currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.0);
                break;
            }
            AABB box = new AABB(currentPos.x - 0.5, currentPos.y - 0.5, currentPos.z - 0.5, currentPos.x + 0.5, currentPos.y + 0.5, currentPos.z + 0.5);
            List<LivingEntity> targets = level.getEntitiesOfClass(LivingEntity.class, box, e -> e != player && e.isAlive());
            if (targets.isEmpty()) continue;
            for (LivingEntity target : targets) {
                target.hurtServer(serverLevel, player.damageSources().playerAttack(player), 999999.0f);
                target.kill(serverLevel);
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.SONIC_BOOM, target.getX(), target.getY() + (double)(target.getBbHeight() / 2.0f), target.getZ(), 1, 0.0, 0.0, 0.0, 0.0);
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.EXPLOSION, target.getX(), target.getY() + (double)(target.getBbHeight() / 2.0f), target.getZ(), 3, 0.1, 0.1, 0.1, 0.05);
            }
            break;
        }
        player.getCooldowns().addCooldown(held, 10);
        return InteractionResult.SUCCESS;
    }
}

