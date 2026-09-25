/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.minecraft.core.particles.ParticleOptions
 *  net.minecraft.core.particles.ParticleTypes
 *  net.minecraft.network.protocol.Packet
 *  net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket
 *  net.minecraft.server.level.ServerLevel
 *  net.minecraft.server.level.ServerPlayer
 *  net.minecraft.sounds.SoundEvent
 *  net.minecraft.sounds.SoundEvents
 *  net.minecraft.sounds.SoundSource
 *  net.minecraft.world.effect.MobEffectInstance
 *  net.minecraft.world.effect.MobEffects
 *  net.minecraft.world.entity.Entity
 *  net.minecraft.world.entity.EntityType
 *  net.minecraft.world.entity.LivingEntity
 *  net.minecraft.world.entity.projectile.throwableitemprojectile.ThrowableItemProjectile
 *  net.minecraft.world.item.Item
 *  net.minecraft.world.item.ItemStack
 *  net.minecraft.world.level.Explosion
 *  net.minecraft.world.level.ExplosionDamageCalculator
 *  net.minecraft.world.level.ItemLike
 *  net.minecraft.world.level.Level
 *  net.minecraft.world.level.Level$ExplosionInteraction
 *  net.minecraft.world.phys.HitResult
 *  net.minecraft.world.phys.Vec3
 */
package com.laserweapons.entity;

import com.laserweapons.LaserWeaponsMod;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrowableItemProjectile;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Explosion;
import net.minecraft.world.level.ExplosionDamageCalculator;
import net.minecraft.world.level.ItemLike;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

public class LaserRocketEntity
extends ThrowableItemProjectile {
    public LaserRocketEntity(EntityType<? extends LaserRocketEntity> entityType, Level level) {
        super(entityType, level);
    }

    public LaserRocketEntity(Level level, LivingEntity owner) {
        super(LaserWeaponsMod.LASER_ROCKET_ENTITY, owner, level, new ItemStack((ItemLike)LaserWeaponsMod.LASER_ROCKET_LAUNCHER));
    }

    protected Item getDefaultItem() {
        return LaserWeaponsMod.LASER_ROCKET_LAUNCHER;
    }

    protected double getDefaultGravity() {
        return 0.005;
    }

    public void tick() {
        super.tick();
        if (this.tickCount % 4 == 0) {
            this.level().playSound(null, this.getX(), this.getY(), this.getZ(), SoundEvents.CONDUIT_AMBIENT_SHORT, SoundSource.PLAYERS, 1.0f, 1.2f);
        }
        if (this.level().isClientSide()) {
            this.level().addParticle((ParticleOptions)ParticleTypes.END_ROD, this.getX(), this.getY(), this.getZ(), -this.getDeltaMovement().x * 0.2, -this.getDeltaMovement().y * 0.2, -this.getDeltaMovement().z * 0.2);
            this.level().addParticle((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, this.getX(), this.getY(), this.getZ(), 0.0, 0.0, 0.0);
            this.level().addParticle((ParticleOptions)ParticleTypes.FLAME, this.getX(), this.getY(), this.getZ(), 0.0, 0.0, 0.0);
        }
    }

    protected void onHit(HitResult hitResult) {
        super.onHit(hitResult);
        if (!this.level().isClientSide()) {
            ServerLevel serverLevel = (ServerLevel)this.level();
            final Entity owner = this.getOwner();
            if (owner instanceof LivingEntity) {
                LivingEntity livingOwner = (LivingEntity)owner;
                double distSq = owner.distanceToSqr(this.getX(), this.getY(), this.getZ());
                if (distSq <= 36.0) {
                    double dist = Math.max(0.4, Math.sqrt(distSq));
                    Vec3 away = owner.position().subtract(this.position());
                    double horiz = Math.min(1.2, 1.0 / dist);
                    Vec3 boost = new Vec3(away.x * horiz * 0.85, Math.max(1.35, 1.9 - dist * 0.15), away.z * horiz * 0.85);
                    owner.setDeltaMovement(owner.getDeltaMovement().add(boost));
                    owner.hurtMarked = true;
                    if (owner instanceof ServerPlayer) {
                        ServerPlayer serverPlayer = (ServerPlayer)owner;
                        serverPlayer.connection.send((Packet)new ClientboundSetEntityMotionPacket(owner));
                    }
                    livingOwner.resetFallDistance();
                    livingOwner.addEffect(new MobEffectInstance(MobEffects.RESISTANCE, 80, 4, false, false, false));
                }
            }
            ExplosionDamageCalculator damageCalculator = new ExplosionDamageCalculator() {

                public boolean shouldDamageEntity(Explosion explosion, Entity entity) {
                    if (entity == owner) {
                        return false;
                    }
                    return super.shouldDamageEntity(explosion, entity);
                }

                public float getEntityDamageAmount(Explosion explosion, Entity entity, float damage) {
                    if (entity == owner) {
                        return 0.0f;
                    }
                    return super.getEntityDamageAmount(explosion, entity, damage);
                }
            };
            this.level().explode((Entity)this, this.level().damageSources().explosion((Entity)this, owner), damageCalculator, this.getX(), this.getY(), this.getZ(), 5.0f, false, Level.ExplosionInteraction.MOB);
            this.level().playSound(null, this.getX(), this.getY(), this.getZ(), (SoundEvent)SoundEvents.GENERIC_EXPLODE.value(), SoundSource.BLOCKS, 1.5f, 1.0f);
            serverLevel.sendParticles((ParticleOptions)ParticleTypes.SONIC_BOOM, this.getX(), this.getY(), this.getZ(), 1, 0.0, 0.0, 0.0, 0.0);
            serverLevel.sendParticles((ParticleOptions)ParticleTypes.EXPLOSION_EMITTER, this.getX(), this.getY(), this.getZ(), 1, 0.0, 0.0, 0.0, 0.0);
            this.discard();
        }
    }
}

