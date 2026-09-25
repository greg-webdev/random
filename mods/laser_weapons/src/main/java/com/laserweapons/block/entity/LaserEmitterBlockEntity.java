/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.minecraft.core.BlockPos
 *  net.minecraft.core.Direction
 *  net.minecraft.core.Position
 *  net.minecraft.core.particles.ParticleOptions
 *  net.minecraft.core.particles.ParticleTypes
 *  net.minecraft.server.level.ServerLevel
 *  net.minecraft.sounds.SoundSource
 *  net.minecraft.world.entity.LivingEntity
 *  net.minecraft.world.level.Level
 *  net.minecraft.world.level.block.entity.BlockEntity
 *  net.minecraft.world.level.block.state.BlockState
 *  net.minecraft.world.level.storage.ValueInput
 *  net.minecraft.world.level.storage.ValueOutput
 *  net.minecraft.world.phys.AABB
 *  net.minecraft.world.phys.Vec3
 */
package com.laserweapons.block.entity;

import com.laserweapons.LaserWeaponsMod;
import com.laserweapons.sound.ModSounds;
import java.util.List;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.Position;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

public class LaserEmitterBlockEntity
extends BlockEntity {
    private float yaw = 0.0f;
    private float pitch = -90.0f;
    private boolean active = true;

    public LaserEmitterBlockEntity(BlockPos pos, BlockState state) {
        super(LaserWeaponsMod.LASER_EMITTER_BLOCK_ENTITY, pos, state);
    }

    public float getYaw() {
        return this.yaw;
    }

    public float getPitch() {
        return this.pitch;
    }

    public boolean isActive() {
        return this.active;
    }

    public void setAngles(float yaw, float pitch) {
        this.yaw = yaw;
        this.pitch = pitch;
        this.setChanged();
    }

    public void setFromDirection(Direction direction) {
        switch (direction) {
            case UP: {
                this.pitch = -90.0f;
                this.yaw = 0.0f;
                break;
            }
            case DOWN: {
                this.pitch = 90.0f;
                this.yaw = 0.0f;
                break;
            }
            case NORTH: {
                this.pitch = 0.0f;
                this.yaw = 180.0f;
                break;
            }
            case SOUTH: {
                this.pitch = 0.0f;
                this.yaw = 0.0f;
                break;
            }
            case WEST: {
                this.pitch = 0.0f;
                this.yaw = 90.0f;
                break;
            }
            case EAST: {
                this.pitch = 0.0f;
                this.yaw = 270.0f;
            }
        }
        this.setChanged();
    }

    public void toggleActive() {
        this.active = !this.active;
        this.setChanged();
    }

    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        this.yaw = input.getFloatOr("Yaw", 0.0f);
        this.pitch = input.getFloatOr("Pitch", -90.0f);
        this.active = input.getBooleanOr("Active", true);
    }

    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        output.putFloat("Yaw", this.yaw);
        output.putFloat("Pitch", this.pitch);
        output.putBoolean("Active", this.active);
    }

    public static void tick(Level level, BlockPos pos, BlockState state, LaserEmitterBlockEntity blockEntity) {
        if (!blockEntity.active) {
            return;
        }
        if (level.isClientSide()) {
            return;
        }
        ServerLevel serverLevel = (ServerLevel)level;
        if (serverLevel.getGameTime() % 70L == 0L) {
            serverLevel.playSound(null, pos, ModSounds.LASER_HUM, SoundSource.BLOCKS, 0.35f, 0.9f);
        }
        Vec3 dir = Vec3.directionFromRotation((float)blockEntity.pitch, (float)blockEntity.yaw);
        Vec3 start = new Vec3((double)pos.getX() + 0.5, (double)pos.getY() + 0.5, (double)pos.getZ() + 0.5);
        double maxDist = 36.0;
        double step = 0.3;
        for (double d = 0.6; d <= maxDist; d += step) {
            BlockState bState;
            BlockPos currentPos;
            Vec3 point = start.add(dir.scale(d));
            serverLevel.sendParticles((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, point.x, point.y, point.z, 1, 0.0, 0.0, 0.0, 0.0);
            if ((int)(d / step) % 4 == 0) {
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.END_ROD, point.x, point.y, point.z, 1, 0.0, 0.0, 0.0, 0.0);
            }
            if (!(currentPos = BlockPos.containing((Position)point)).equals((Object)pos) && !(bState = serverLevel.getBlockState(currentPos)).isAir() && bState.canOcclude()) {
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.FLAME, point.x, point.y, point.z, 1, 0.03, 0.03, 0.03, 0.01);
                break;
            }
            AABB box = new AABB(point.x - 0.35, point.y - 0.35, point.z - 0.35, point.x + 0.35, point.y + 0.35, point.z + 0.35);
            List<LivingEntity> targets = serverLevel.getEntitiesOfClass(LivingEntity.class, box, LivingEntity::isAlive);
            for (LivingEntity entity : targets) {
                entity.hurtServer(serverLevel, serverLevel.damageSources().lava(), 6.0f);
                entity.setRemainingFireTicks(60);
            }
        }
    }
}

