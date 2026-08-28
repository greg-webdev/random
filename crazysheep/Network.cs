using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace CrazyCattle3D
{
    // ---------------------------------------------------------------------------
    //  Roles
    // ---------------------------------------------------------------------------
    public enum NetRole { None, Host, Client }
    public enum SheepRole { Local, Remote, Bot }

    // ---------------------------------------------------------------------------
    //  Packet types  (1 byte header)
    // ---------------------------------------------------------------------------
    public enum NetPacketType : byte
    {
        Hello        = 1,  // Client → Host: "I want to join"
        Welcome      = 2,  // Host → Client: "You are slot N, here are all players"
        PlayerList   = 3,  // Host → All: updated player list
        MatchStart   = 4,  // Host → All: start the game (includes RNG seed)
        InputUpdate  = 5,  // Client → Host: local input this frame
        StateSnapshot= 6,  // Host → All: full authoritative state
        PlayerLeave  = 7,  // Host → All: someone disconnected
        Ping         = 8,  // Either direction
        Pong         = 9,  // Either direction
        Chat         = 10, // Either direction (baa messages)
    }

    // ---------------------------------------------------------------------------
    //  Per-sheep networked state snapshot (sent at 20 Hz by host)
    // ---------------------------------------------------------------------------
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct SheepNetState
    {
        public float PosX, PosY, PosZ;
        public float VelX, VelY, VelZ;
        public float Yaw, Pitch, Roll;
        public float RollVel, PitchVel, YawVel;
        public float DashEnergy;
        public byte  Flags; // bit0=IsAlive bit1=IsTipped bit2=IsDashing bit3=IsGrounded bit4=IsSuperHeavy
        public byte  Kills;
        public ushort Pad;  // alignment

        public bool IsAlive      => (Flags & 0x01) != 0;
        public bool IsTipped     => (Flags & 0x02) != 0;
        public bool IsDashing    => (Flags & 0x04) != 0;
        public bool IsGrounded   => (Flags & 0x08) != 0;
        public bool IsSuperHeavy => (Flags & 0x10) != 0;

        public static SheepNetState FromSheep(Sheep s)
        {
            byte flags = 0;
            if (s.IsAlive)      flags |= 0x01;
            if (s.IsTipped)     flags |= 0x02;
            if (s.IsDashing)    flags |= 0x04;
            if (s.IsGrounded)   flags |= 0x08;
            if (s.IsSuperHeavy) flags |= 0x10;
            return new SheepNetState
            {
                PosX = s.Position.X, PosY = s.Position.Y, PosZ = s.Position.Z,
                VelX = s.Velocity.X, VelY = s.Velocity.Y, VelZ = s.Velocity.Z,
                Yaw = s.Yaw, Pitch = s.Pitch, Roll = s.Roll,
                RollVel = s.RollVelocity, PitchVel = s.PitchVelocity, YawVel = s.YawVelocity,
                DashEnergy = s.DashEnergy,
                Flags = flags,
                Kills = (byte)Math.Min(s.Kills, 255),
                Pad = 0
            };
        }
    }

    // ---------------------------------------------------------------------------
    //  Input packet (Client → Host, 60 Hz)
    // ---------------------------------------------------------------------------
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct InputPacket
    {
        public float  Throttle;
        public float  Steer;
        public byte   Buttons;   // bit0=Dash bit1=Jump bit2=Baa bit3=SuperHeavyToggle
        public ushort Seq;
        public byte   Pad;

        public bool WantDash   => (Buttons & 0x01) != 0;
        public bool WantJump   => (Buttons & 0x02) != 0;
        public bool WantBaa    => (Buttons & 0x04) != 0;
        public bool ToggleHeavy=> (Buttons & 0x08) != 0;
    }

    // ---------------------------------------------------------------------------
    //  A connected peer (from the host's perspective)
    // ---------------------------------------------------------------------------
    public class NetPeer
    {
        public IPEndPoint EndPoint;
        public int        SlotIndex;       // which sheep slot this player owns
        public string     PlayerName = ""; 
        public float      LastPingTime;
        public float      LatencyMs;
        public ushort     LastSeq;
        public bool       IsReady;

        public InputPacket LastInput;
        public bool        HasFreshInput;

        public NetPeer(IPEndPoint ep, int slot) { EndPoint = ep; SlotIndex = slot; }
    }

    // ---------------------------------------------------------------------------
    //  A pending received packet
    // ---------------------------------------------------------------------------
    public class RawPacket
    {
        public NetPacketType Type;
        public byte[]        Data;
        public IPEndPoint    From;
        public RawPacket(NetPacketType t, byte[] d, IPEndPoint f) { Type = t; Data = d; From = f; }
    }

    // ============================================================================
    //  NetworkManager — the main networking class
    // ============================================================================
    public class NetworkManager : IDisposable
    {
        public const int DefaultPort = 7777;
        public const int MaxPlayers  = 8;

        public NetRole Role { get; private set; } = NetRole.None;

        // Host-side
        public List<NetPeer> Peers { get; } = new();

        // Client-side
        public int  LocalSlot      { get; private set; } = 0;
        public bool IsConnected    { get; private set; }
        public float LatencyMs     { get; private set; }

        // Shared
        public bool MatchStarted   { get; private set; }
        public int  MatchSeed      { get; private set; }
        public string LocalName    { get; set; } = "Player";

        // Incoming packet queue (thread-safe — background receive thread posts here)
        private readonly ConcurrentQueue<RawPacket> _inQueue = new();

        private UdpClient?  _udp;
        private IPEndPoint? _hostEP; // client: host's endpoint
        private Thread?     _recvThread;
        private volatile bool _running;

        private float _pingTimer;
        private ushort _inputSeq;

        // Player name slots (parallel to sheep array) populated from host messages
        private string[] _slotNames = new string[40];

        public string GetSlotName(int slot) =>
            slot < _slotNames.Length ? (_slotNames[slot] ?? "") : "";

        // -----------------------------------------------------------------------
        //  Start listening as host
        // -----------------------------------------------------------------------
        public void StartHost(int port = DefaultPort)
        {
            Role = NetRole.Host;
            LocalSlot = 0;
            _slotNames[0] = LocalName;

            _udp = new UdpClient(port);
            _udp.Client.Blocking = false;
            _running = true;
            _recvThread = new Thread(ReceiveLoop) { IsBackground = true, Name = "NetRecv" };
            _recvThread.Start();
            Console.WriteLine($"[NET] Hosting on port {port}");
        }

        // -----------------------------------------------------------------------
        //  Connect to a host as a client
        // -----------------------------------------------------------------------
        public void StartClient(string ip, int port = DefaultPort)
        {
            Role = NetRole.Client;
            _hostEP = new IPEndPoint(IPAddress.Parse(ip), port);
            _udp = new UdpClient();
            _udp.Client.Blocking = false;
            _running = true;
            _recvThread = new Thread(ReceiveLoop) { IsBackground = true, Name = "NetRecv" };
            _recvThread.Start();

            // Send initial Hello
            SendHello();
            Console.WriteLine($"[NET] Connecting to {ip}:{port}");
        }

        // -----------------------------------------------------------------------
        //  Host: tell everyone to start
        // -----------------------------------------------------------------------
        public void HostStartMatch(int seed)
        {
            MatchStarted = true;
            MatchSeed = seed;

            // Build player list packet
            byte[] listPkt = BuildPlayerListPacket();

            // Build start packet: type(1) + seed(4) + playerList
            byte[] startPkt = new byte[5 + listPkt.Length];
            startPkt[0] = (byte)NetPacketType.MatchStart;
            BitConverter.TryWriteBytes(startPkt.AsSpan(1), seed);
            listPkt.CopyTo(startPkt, 5);

            BroadcastRaw(startPkt);
        }

        // -----------------------------------------------------------------------
        //  Host: broadcast full game state to all clients
        // -----------------------------------------------------------------------
        public unsafe void BroadcastState(Sheep[] sheep)
        {
            if (Role != NetRole.Host || Peers.Count == 0) return;

            int stateSize = sizeof(SheepNetState);
            int totalSize = 1 + 1 + sheep.Length * stateSize; // type + count + states
            byte[] pkt = new byte[totalSize];
            pkt[0] = (byte)NetPacketType.StateSnapshot;
            pkt[1] = (byte)sheep.Length;

            for (int i = 0; i < sheep.Length; i++)
            {
                SheepNetState state = SheepNetState.FromSheep(sheep[i]);
                MemoryMarshal.Write(pkt.AsSpan(2 + i * stateSize), ref state);
            }

            BroadcastRaw(pkt);
        }

        // -----------------------------------------------------------------------
        //  Client: send local player input to host
        // -----------------------------------------------------------------------
        public unsafe void SendInput(InputPacket input)
        {
            if (Role != NetRole.Client || _hostEP == null) return;

            input.Seq = _inputSeq++;
            int pktSize = 1 + sizeof(InputPacket);
            byte[] pkt = new byte[pktSize];
            pkt[0] = (byte)NetPacketType.InputUpdate;
            MemoryMarshal.Write(pkt.AsSpan(1), ref input);
            SendRaw(pkt, _hostEP);
        }

        // -----------------------------------------------------------------------
        //  Client: send baa chat to host (host rebroadcasts)
        // -----------------------------------------------------------------------
        public void SendBaa(string text)
        {
            if (_hostEP == null && Role != NetRole.Host) return;
            byte[] textBytes = Encoding.UTF8.GetBytes(text.Length > 20 ? text[..20] : text);
            byte[] pkt = new byte[2 + textBytes.Length];
            pkt[0] = (byte)NetPacketType.Chat;
            pkt[1] = (byte)LocalSlot;
            textBytes.CopyTo(pkt, 2);
            if (Role == NetRole.Client) SendRaw(pkt, _hostEP!);
            else                        DispatchChatPacket(pkt, null);
        }

        // -----------------------------------------------------------------------
        //  Poll the incoming packet queue — called from main thread each frame
        //  Returns list of freshly received packets for the caller to handle
        // -----------------------------------------------------------------------
        public List<RawPacket> PollPackets()
        {
            var result = new List<RawPacket>();
            while (_inQueue.TryDequeue(out var pkt))
                result.Add(pkt);
            return result;
        }

        // -----------------------------------------------------------------------
        //  Tick — called every frame (handles ping and any per-frame networking)
        // -----------------------------------------------------------------------
        public void Tick(float dt)
        {
            _pingTimer -= dt;
            if (_pingTimer <= 0f)
            {
                _pingTimer = 2.0f;
                SendPing();
            }
        }

        // -----------------------------------------------------------------------
        //  Apply a state snapshot packet to a sheep array (client-side)
        // -----------------------------------------------------------------------
        public unsafe void ApplySnapshot(RawPacket pkt, Sheep[] sheep)
        {
            if (pkt.Data.Length < 2) return;
            int count = pkt.Data[1];
            int stateSize = sizeof(SheepNetState);

            for (int i = 0; i < count && i < sheep.Length; i++)
            {
                int offset = 2 + i * stateSize;
                if (offset + stateSize > pkt.Data.Length) break;

                SheepNetState state = MemoryMarshal.Read<SheepNetState>(pkt.Data.AsSpan(offset));

                // Don't override the local player's sheep (we predict locally)
                if (i == LocalSlot) continue;

                sheep[i].ApplyNetState(state);
            }
        }

        // Host: get the latest input for a peer slot
        public bool TryGetPeerInput(int slot, out InputPacket input)
        {
            input = default;
            foreach (var peer in Peers)
            {
                if (peer.SlotIndex == slot && peer.HasFreshInput)
                {
                    input = peer.LastInput;
                    peer.HasFreshInput = false;
                    return true;
                }
            }
            return false;
        }

        public float GetPeerLatency(int slot)
        {
            foreach (var peer in Peers)
                if (peer.SlotIndex == slot) return peer.LatencyMs;
            return 0f;
        }

        // -----------------------------------------------------------------------
        //  Internal — receive loop (background thread)
        // -----------------------------------------------------------------------
        private void ReceiveLoop()
        {
            IPEndPoint any = new IPEndPoint(IPAddress.Any, 0);
            while (_running)
            {
                try
                {
                    byte[]? data = null;
                    IPEndPoint? from = null;
                    try
                    {
                        data = _udp!.Receive(ref any!);
                        from = any;
                    }
                    catch (SocketException ex) when (ex.SocketErrorCode == SocketError.WouldBlock)
                    {
                        Thread.Sleep(1);
                        continue;
                    }

                    if (data == null || data.Length == 0) continue;
                    var type = (NetPacketType)data[0];
                    _inQueue.Enqueue(new RawPacket(type, data, from));

                    // Handle on background thread only for time-sensitive items
                    if (type == NetPacketType.Ping || type == NetPacketType.Pong)
                        HandlePingPong(data, from);
                    else if (type == NetPacketType.Hello && Role == NetRole.Host)
                        HandleHello(data, from);
                    else if (type == NetPacketType.InputUpdate && Role == NetRole.Host)
                        HandleInputUpdate(data, from);
                }
                catch (ObjectDisposedException) { break; }
                catch (Exception ex) { Console.WriteLine($"[NET] Recv error: {ex.Message}"); }
            }
        }

        // -----------------------------------------------------------------------
        //  Protocol handlers
        // -----------------------------------------------------------------------

        private void HandleHello(byte[] data, IPEndPoint from)
        {
            // data: type(1) + nameLen(1) + name(N)
            if (data.Length < 3) return;
            int nameLen = data[1];
            string name = Encoding.UTF8.GetString(data, 2, Math.Min(nameLen, data.Length - 2));
            name = name.Length > 12 ? name[..12] : name;

            lock (Peers)
            {
                // Check not already connected
                foreach (var p in Peers)
                    if (p.EndPoint.Equals(from)) return;

                if (Peers.Count >= MaxPlayers - 1) return; // slot 0 = host

                int slot = Peers.Count + 1;
                var peer = new NetPeer(from, slot) { PlayerName = name };
                Peers.Add(peer);
                _slotNames[slot] = name;

                Console.WriteLine($"[NET] {name} joined as slot {slot}");

                // Send Welcome: type(1) + slot(1) + totalSlots(1) + playerList
                byte[] listPkt = BuildPlayerListPacket();
                byte[] welcome = new byte[3 + listPkt.Length];
                welcome[0] = (byte)NetPacketType.Welcome;
                welcome[1] = (byte)slot;
                welcome[2] = (byte)(Peers.Count + 1); // total players including host
                listPkt.CopyTo(welcome, 3);
                SendRaw(welcome, from);

                // Broadcast updated player list to all existing peers
                byte[] fullList = new byte[1 + listPkt.Length];
                fullList[0] = (byte)NetPacketType.PlayerList;
                listPkt.CopyTo(fullList, 1);
                BroadcastRaw(fullList, exclude: from);
            }
        }

        private unsafe void HandleInputUpdate(byte[] data, IPEndPoint from)
        {
            int inputSize = sizeof(InputPacket);
            if (data.Length < 1 + inputSize) return;
            InputPacket input = MemoryMarshal.Read<InputPacket>(data.AsSpan(1));

            lock (Peers)
            {
                foreach (var peer in Peers)
                {
                    if (peer.EndPoint.Equals(from))
                    {
                        // Only accept newer sequence numbers (handles reordering)
                        if (input.Seq > peer.LastSeq || (peer.LastSeq > 60000 && input.Seq < 1000))
                        {
                            peer.LastSeq = input.Seq;
                            peer.LastInput = input;
                            peer.HasFreshInput = true;
                        }
                        break;
                    }
                }
            }
        }

        private void HandlePingPong(byte[] data, IPEndPoint from)
        {
            if (data[0] == (byte)NetPacketType.Ping)
            {
                // Reflect pong immediately
                byte[] pong = new byte[5];
                pong[0] = (byte)NetPacketType.Pong;
                data.AsSpan(1, 4).CopyTo(pong.AsSpan(1));
                SendRaw(pong, from);
            }
            else // Pong
            {
                float sentTime = BitConverter.ToSingle(data, 1);
                float rtt = (float)(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0) - sentTime;
                float latency = rtt * 500f; // half-RTT in ms

                if (Role == NetRole.Host)
                {
                    lock (Peers)
                    {
                        foreach (var p in Peers)
                            if (p.EndPoint.Equals(from)) { p.LatencyMs = latency; break; }
                    }
                }
                else
                {
                    LatencyMs = latency;
                }
            }
        }

        private void DispatchChatPacket(byte[] data, IPEndPoint? from)
        {
            // Host broadcasts chat to everyone (including local enqueue)
            if (Role == NetRole.Host)
            {
                BroadcastRaw(data, exclude: from);
                // Also enqueue locally so host sees it
                _inQueue.Enqueue(new RawPacket(NetPacketType.Chat, data,
                    from ?? new IPEndPoint(IPAddress.Loopback, 0)));
            }
        }

        // -----------------------------------------------------------------------
        //  Client sends Hello
        // -----------------------------------------------------------------------
        private void SendHello()
        {
            byte[] nameBytes = Encoding.UTF8.GetBytes(LocalName.Length > 12 ? LocalName[..12] : LocalName);
            byte[] pkt = new byte[2 + nameBytes.Length];
            pkt[0] = (byte)NetPacketType.Hello;
            pkt[1] = (byte)nameBytes.Length;
            nameBytes.CopyTo(pkt, 2);
            SendRaw(pkt, _hostEP!);
        }

        private void SendPing()
        {
            float t = (float)(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0);
            byte[] pkt = new byte[5];
            pkt[0] = (byte)NetPacketType.Ping;
            BitConverter.TryWriteBytes(pkt.AsSpan(1), t);
            if (Role == NetRole.Host)
            {
                lock (Peers)
                    foreach (var p in Peers)
                        SendRaw(pkt, p.EndPoint);
            }
            else if (_hostEP != null)
            {
                SendRaw(pkt, _hostEP);
            }
        }

        // -----------------------------------------------------------------------
        //  Player list packet builder (used in Welcome + PlayerList)
        //  Format: count(1) + for each: slot(1) + nameLen(1) + name(N)
        // -----------------------------------------------------------------------
        private byte[] BuildPlayerListPacket()
        {
            var buf = new System.IO.MemoryStream();
            int totalPlayers = Peers.Count + 1;
            buf.WriteByte((byte)totalPlayers);

            // Write host (slot 0)
            byte[] hostNameBytes = Encoding.UTF8.GetBytes(LocalName.Length > 12 ? LocalName[..12] : LocalName);
            buf.WriteByte(0);
            buf.WriteByte((byte)hostNameBytes.Length);
            buf.Write(hostNameBytes);

            // Write peers
            lock (Peers)
            {
                foreach (var p in Peers)
                {
                    byte[] nb = Encoding.UTF8.GetBytes(p.PlayerName.Length > 12 ? p.PlayerName[..12] : p.PlayerName);
                    buf.WriteByte((byte)p.SlotIndex);
                    buf.WriteByte((byte)nb.Length);
                    buf.Write(nb);
                }
            }

            return buf.ToArray();
        }

        // Parse a player list packet, fill in _slotNames
        public void ParsePlayerList(byte[] data, int offset)
        {
            if (offset >= data.Length) return;
            int count = data[offset++];
            for (int i = 0; i < count && offset < data.Length; i++)
            {
                int slot    = data[offset++];
                int nameLen = data[offset++];
                if (offset + nameLen > data.Length) break;
                string name = Encoding.UTF8.GetString(data, offset, nameLen);
                offset += nameLen;
                if (slot < _slotNames.Length)
                    _slotNames[slot] = name;
            }
        }

        // -----------------------------------------------------------------------
        //  Low-level send helpers
        // -----------------------------------------------------------------------
        private void SendRaw(byte[] data, IPEndPoint to)
        {
            try { _udp?.Send(data, data.Length, to); }
            catch (Exception ex) { Console.WriteLine($"[NET] Send error: {ex.Message}"); }
        }

        private void BroadcastRaw(byte[] data, IPEndPoint? exclude = null)
        {
            lock (Peers)
            {
                foreach (var p in Peers)
                {
                    if (exclude != null && p.EndPoint.Equals(exclude)) continue;
                    SendRaw(data, p.EndPoint);
                }
            }
        }

        // -----------------------------------------------------------------------
        //  Shutdown
        // -----------------------------------------------------------------------
        public void Dispose()
        {
            _running = false;
            _udp?.Close();
            _udp?.Dispose();
            _recvThread?.Join(500);
        }
    }
}
