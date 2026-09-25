/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.fabricmc.api.ClientModInitializer
 *  net.fabricmc.api.EnvType
 *  net.fabricmc.api.Environment
 *  net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry
 *  net.minecraft.client.renderer.entity.ThrownItemRenderer
 */
package com.laserweapons.client;

import com.laserweapons.LaserWeaponsMod;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;
import net.minecraft.client.renderer.entity.ThrownItemRenderer;

@Environment(value=EnvType.CLIENT)
public class LaserWeaponsClient
implements ClientModInitializer {
    public void onInitializeClient() {
        EntityRendererRegistry.register(LaserWeaponsMod.LASER_ROCKET_ENTITY, ThrownItemRenderer::new);
    }
}

