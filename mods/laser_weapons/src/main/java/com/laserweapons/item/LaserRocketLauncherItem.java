/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.minecraft.core.particles.ParticleOptions
 *  net.minecraft.core.particles.ParticleTypes
 *  net.minecraft.server.level.ServerLevel
 *  net.minecraft.sounds.SoundSource
 *  net.minecraft.world.InteractionHand
 *  net.minecraft.world.InteractionResult
 *  net.minecraft.world.entity.Entity
 *  net.minecraft.world.entity.LivingEntity
 *  net.minecraft.world.entity.player.Player
 *  net.minecraft.world.item.Item
 *  net.minecraft.world.item.Item$Properties
 *  net.minecraft.world.item.ItemStack
 *  net.minecraft.world.level.Level
 *  net.minecraft.world.phys.Vec3
 */
package com.laserweapons.item;

import com.laserweapons.entity.LaserRocketEntity;
import com.laserweapons.sound.ModSounds;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;

public class LaserRocketLauncherItem
extends Item {
    public LaserRocketLauncherItem(Item.Properties properties) {
        super(properties);
    }

    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        ItemStack held = player.getItemInHand(hand);
        if (!level.isClientSide()) {
            ServerLevel serverLevel = (ServerLevel)level;
            LaserRocketEntity rocket = new LaserRocketEntity(level, (LivingEntity)player);
            rocket.shootFromRotation((Entity)player, player.getXRot(), player.getYRot(), 0.0f, 2.5f, 0.5f);
            level.addFreshEntity((Entity)rocket);
            level.playSound(null, player.getX(), player.getY(), player.getZ(), ModSounds.ROCKET_FIRE, SoundSource.PLAYERS, 1.0f, 1.0f);
            Vec3 look = player.getLookAngle();
            Vec3 backblast = player.getEyePosition().subtract(look.scale(0.8));
            serverLevel.sendParticles((ParticleOptions)ParticleTypes.CAMPFIRE_COSY_SMOKE, backblast.x, backblast.y, backblast.z, 6, 0.1, 0.1, 0.1, 0.05);
            serverLevel.sendParticles((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, backblast.x, backblast.y, backblast.z, 8, 0.2, 0.2, 0.2, 0.1);
        }
        player.getCooldowns().addCooldown(held, 25);
        return InteractionResult.SUCCESS;
    }
}

