const mc = require('minecraft-protocol');
const des = mc.createDeserializer({isServer: false, version: '1.21.11', state: 'play'});
const ser = mc.createSerializer({isServer: true, version: '1.21.11', state: 'play'});

ser.on('data', b => {
    console.log('SPAWN_ENTITY SERIALIZED:', b.length, 'bytes');
    des.write(b);
});

des.on('data', d => console.log('SPAWN_ENTITY DESERIALIZED 100% SUCCESS:', d.data.name, 'eid:', d.data.params.entityId));
des.on('error', e => console.error('DES ERROR:', e));

ser.write({
    name: 'spawn_entity',
    params: {
        entityId: 100,
        objectUUID: '00000000-0000-0000-0000-000000000001',
        type: 155,
        x: 8.0,
        y: 16.0,
        z: 8.0,
        velocity: { x: 0, y: 0, z: 0 },
        pitch: 0,
        yaw: 0,
        headPitch: 0,
        objectData: 0
    }
});
