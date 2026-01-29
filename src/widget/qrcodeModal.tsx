import React from "react";
import { QRCodeSVG } from "qrcode.react";

export function QRCodeModal({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose?: () => void;
}) {
  if (!uri) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "24px",
          width: "320px",
          textAlign: "center",
          position: "relative",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "12px",
            border: "none",
            background: "transparent",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>

        <h2 style={styles.title}>Scan to Connect</h2>

        <div style={styles.qrContainer}>
          <QRCodeSVG value={uri} size={220} />
        </div>

        <p style={styles.text}>
          Scan this QR code using your wallet to connect.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "24px",
    width: "320px",
    textAlign: "center",
    position: "relative",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  },
  closeButton: {
    position: "absolute",
    top: "10px",
    right: "12px",
    border: "none",
    background: "transparent",
    fontSize: "18px",
    cursor: "pointer",
  },
  title: {
    marginBottom: "16px",
  },
  qrContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "16px",
  },
  text: {
    fontSize: "14px",
    color: "#555",
  },
};
