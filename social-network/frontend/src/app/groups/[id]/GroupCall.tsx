import React, { useEffect, useRef, useState } from "react";

interface GroupCallProps {
  groupId: number;
  meId: number;
  wsSend: (msg: any) => void;
  wsMessages: any[];
  onClose: () => void;
}

export default function GroupCall({ groupId, meId, wsSend, wsMessages, onClose }: GroupCallProps) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ id: string; stream: MediaStream }[]>([]);
  const pcRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start local media
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
        wsSend({ type: "call-join", group_id: groupId, sender_id: meId });
      })
      .catch(() => setError("Could not access camera/mic"));
    return () => {
      Object.values(pcRef.current).forEach(pc => pc.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Handle signaling
  useEffect(() => {
    wsMessages.forEach(msg => {
      if (msg.type === "call-offer" && msg.sender_id !== meId) {
        handleOffer(msg.sender_id, msg.sdp);
      } else if (msg.type === "call-answer" && msg.sender_id !== meId) {
        handleAnswer(msg.sender_id, msg.sdp);
      } else if (msg.type === "call-candidate" && msg.sender_id !== meId) {
        handleCandidate(msg.sender_id, msg.candidate);
      } else if (msg.type === "call-leave" && msg.sender_id !== meId) {
        if (pcRef.current[msg.sender_id]) {
          pcRef.current[msg.sender_id].close();
          delete pcRef.current[msg.sender_id];
          setRemoteStreams(s => s.filter(r => r.id !== String(msg.sender_id)));
        }
      }
    });
    // eslint-disable-next-line
  }, [wsMessages]);

  // Create offer to new peer
  function callPeer(peerId: number) {
    const pc = createPeerConnection(peerId);
    pcRef.current[peerId] = pc;
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      wsSend({ type: "call-offer", group_id: groupId, sender_id: meId, target_id: peerId, sdp: offer });
    });
  }

  function createPeerConnection(peerId: number) {
    const pc = new RTCPeerConnection();
    pc.onicecandidate = e => {
      if (e.candidate) wsSend({ type: "call-candidate", group_id: groupId, sender_id: meId, target_id: peerId, candidate: e.candidate });
    };
    pc.ontrack = e => {
      setRemoteStreams(s => {
        const exists = s.find(r => r.id === String(peerId));
        if (exists) return s;
        return [...s, { id: String(peerId), stream: e.streams[0] }];
      });
    };
    return pc;
  }

  function handleOffer(peerId: number, sdp: any) {
    const pc = createPeerConnection(peerId);
    pcRef.current[peerId] = pc;
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    pc.setRemoteDescription(new RTCSessionDescription(sdp));
    pc.createAnswer().then(answer => {
      pc.setLocalDescription(answer);
      wsSend({ type: "call-answer", group_id: groupId, sender_id: meId, target_id: peerId, sdp: answer });
    });
  }

  function handleAnswer(peerId: number, sdp: any) {
    const pc = pcRef.current[peerId];
    if (pc) pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  function handleCandidate(peerId: number, candidate: any) {
    const pc = pcRef.current[peerId];
    if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, minWidth: 320, boxShadow: "0 2px 16px #0002", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <h2>Group Call</h2>
        {error && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div>}
        <video ref={localVideo} autoPlay muted playsInline style={{ width: 180, borderRadius: 8, marginBottom: 12, background: "#222" }} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {remoteStreams.map(r => (
            <video key={r.id} ref={el => { if (el) el.srcObject = r.stream; }} autoPlay playsInline style={{ width: 180, borderRadius: 8, background: "#222" }} />
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 18, background: "#fa3e3e", color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.5rem", fontWeight: 600, fontSize: 16, cursor: "pointer" }}>Leave Call</button>
      </div>
    </div>
  );
}
