// Web Serial (USB Cable) ESC/POS Thermal Printer Driver

let serialPort: any = null;
let serialWriter: any = null;

export function isWebSerialSupported(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && "serial" in navigator;
}

export function getConnectedUsbDeviceName(): string | null {
  if (!serialPort) return null;
  const info = serialPort.getInfo?.() || {};
  return info.usbVendorId ? `USB Thermal Printer (VID: ${info.usbVendorId.toString(16)})` : "USB Thermal Printer";
}

export async function connectUsbPrinter(): Promise<string> {
  if (!isWebSerialSupported()) {
    throw new Error("Web Serial is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await openPort(port);
    serialPort = port;
    const name = getConnectedUsbDeviceName() || "USB Thermal Receipt Printer";
    return name;
  } catch (err: any) {
    console.error("USB printer connection error:", err);
    throw new Error(err.message || "Failed to connect USB Cable printer");
  }
}

async function openPort(port: any) {
  if (!port.readable) {
    await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });
  }
}

export async function sendEscPosToUsb(bytes: Uint8Array): Promise<void> {
  if (!serialPort) {
    // Try auto-reconnecting to previously paired port
    if (isWebSerialSupported()) {
      const ports = await (navigator as any).serial.getPorts();
      if (ports && ports.length > 0) {
        serialPort = ports[0];
        await openPort(serialPort);
      }
    }
  }

  if (!serialPort || !serialPort.writable) {
    throw new Error("No USB Thermal printer connected. Please click 'Connect USB Cable Printer' in Settings.");
  }

  const writer = serialPort.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}
