/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.minecraft.core.Registry
 *  net.minecraft.core.registries.BuiltInRegistries
 *  net.minecraft.resources.Identifier
 *  net.minecraft.sounds.SoundEvent
 */
package com.laserweapons.sound;

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.sounds.SoundEvent;

public class ModSounds {
    public static final SoundEvent GUN_SHOT = ModSounds.register("gun_shot");
    public static final SoundEvent GUNSHOT = ModSounds.register("gunshot");
    public static final SoundEvent ROCKET_FIRE = ModSounds.register("rocket_fire");
    public static final SoundEvent LASER_EXPLOSION = ModSounds.register("laser_explosion");
    public static final SoundEvent LASER_HUM = ModSounds.register("laser_hum");

    private static SoundEvent register(String name) {
        Identifier id = Identifier.fromNamespaceAndPath((String)"laser_weapons", (String)name);
        SoundEvent soundEvent = SoundEvent.createVariableRangeEvent((Identifier)id);
        return (SoundEvent)Registry.register((Registry)BuiltInRegistries.SOUND_EVENT, (Identifier)id, (Object)soundEvent);
    }

    public static void initialize() {
    }
}

