// Web Bluetooth ESC/POS Thermal Printer Helper

let bluetoothDevice: any = null;
let bluetoothCharacteristic: any = null;

export function isWebBluetoothSupported(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function getConnectedBluetoothDeviceName(): string | null {
  return bluetoothDevice?.name || null;
}

export async function connectBluetoothPrinter(): Promise<string> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
  }

  // Common Bluetooth SPP / Thermal Printer Service UUIDs
  const serviceUUIDs = [
    "000018f0-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4113-8b0f-9990742725b5",
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    "00001101-0000-1000-8000-00805f9b34fb",
  ];

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: serviceUUIDs,
    });

    if (!device) {
      throw new Error("No Bluetooth printer selected.");
    }

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    let writeCharacteristic = null;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic) {
      throw new Error("Could not find writable characteristic on selected Bluetooth device.");
    }

    bluetoothDevice = device;
    bluetoothCharacteristic = writeCharacteristic;

    return device.name || "Bluetooth Thermal Printer";
  } catch (err: any) {
    console.error("Bluetooth printer connection error:", err);
    throw new Error(err.message || "Failed to connect Bluetooth printer");
  }
}

export async function sendEscPosToBluetooth(bytes: Uint8Array): Promise<void> {
  if (!bluetoothCharacteristic) {
    throw new Error("No Bluetooth printer connected. Please connect printer in POS Settings.");
  }

  const chunkSize = 128;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (bluetoothCharacteristic.properties.writeWithoutResponse) {
      await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await bluetoothCharacteristic.writeValue(chunk);
    }
  }
}

// ESC/POS Command Generator Helpers
class EscPosEncoder {
  private buffer: number[] = [];

  init() {
    this.buffer.push(0x1b, 0x40); // ESC @
    return this;
  }

  alignCenter() {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  bold(enable: boolean) {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  textSize(width: number = 1, height: number = 1) {
    const size = ((width - 1) << 4) | (height - 1);
    this.buffer.push(0x1d, 0x21, size);
    return this;
  }

  text(str: string) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    encoded.forEach((byte) => this.buffer.push(byte));
    return this;
  }

  line(str: string = "") {
    this.text(str + "\n");
    return this;
  }

  dashedLine() {
    this.line("------------------------------------------------");
    return this;
  }

  feed(lines: number = 3) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  cut() {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, 0x00); // GS V 0 (Cut paper)
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export function buildEscPosKotReceipt(
  kotNumber: string,
  orderType: string,
  items: Array<{ name: string; quantity: number; notes?: string }>
): Uint8Array {
  const encoder = new EscPosEncoder();
  encoder.init();
  encoder.alignCenter().bold(true).textSize(2, 2).line(`KOT - ${kotNumber.replace("KOT-", "")}`);
  encoder.textSize(1, 1).bold(false).line(`ORDER: ${orderType.toUpperCase()}`);
  const now = new Date();
  encoder.line(`${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);
  encoder.dashedLine();

  encoder.alignLeft().bold(true).line("No.  Item Name".padEnd(38, " ") + "Qty".padStart(10, " "));
  encoder.dashedLine();

  items.forEach((item, idx) => {
    const num = `${idx + 1}.`.padEnd(5, " ");
    const name = item.name.padEnd(33, " ").substring(0, 33);
    const qty = item.quantity.toString().padStart(10, " ");
    encoder.bold(false).line(`${num}${name}${qty}`);
    if (item.notes) {
      encoder.line(`     >> Note: ${item.notes}`);
    }
  });

  encoder.dashedLine();
  encoder.cut();
  return encoder.encode();
}

export function buildEscPosBillReceipt(
  outletName: string,
  outletAddress: string,
  billNumber: string,
  tokenNumber: string,
  orderType: string,
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>,
  totalAmount: number,
  phone?: string,
  cashierName?: string
): Uint8Array {
  const encoder = new EscPosEncoder();
  encoder.init();

  // Header
  encoder.alignCenter().bold(true).textSize(2, 2).line(outletName || "BOMBAY FALOODA");
  encoder.textSize(1, 1).bold(false);
  if (outletAddress) encoder.line(outletAddress);
  if (phone) encoder.line(`Ph: ${phone}`);
  encoder.dashedLine();

  // Details (48 columns)
  encoder.alignLeft().bold(false);
  const now = new Date();
  const dateStr = `Date: ${now.toLocaleDateString("en-GB")}`.padEnd(24, " ");
  const timeStr = `Time: ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  encoder.line(`${dateStr}${timeStr}`);

  const billStr = `Bill No: ${billNumber.replace("BILL-", "")}`.padEnd(24, " ");
  const orderStr = `Order: ${orderType}`;
  encoder.line(`${billStr}${orderStr}`);

  const tokenStr = `Token No: ${tokenNumber.replace("KOT-", "")}`.padEnd(24, " ");
  const cashierStr = `Cashier: ${cashierName || "biller"}`;
  encoder.line(`${tokenStr}${cashierStr}`);
  encoder.dashedLine();

  // Table (48 cols: Item Name 28, Qty 6, Amount 14)
  encoder.bold(true).line("Item Name".padEnd(28, " ") + "Qty".padStart(6, " ") + "Amount".padStart(14, " "));
  encoder.dashedLine();

  items.forEach((item) => {
    const name = item.name.padEnd(28, " ").substring(0, 28);
    const qty = item.quantity.toString().padStart(6, " ");
    const amt = item.total.toFixed(2).padStart(14, " ");
    encoder.bold(false).line(`${name}${qty}${amt}`);
  });

  encoder.dashedLine();
  encoder.alignCenter().bold(true).textSize(2, 2).line(`Grand Total: Rs ${totalAmount.toFixed(2)}`);
  encoder.textSize(1, 1).dashedLine();
  encoder.alignCenter().bold(false).line("Thank You! Please Visit Again");
  encoder.line("Please wait for 10 minutes after ordering.");
  encoder.cut();

  return encoder.encode();
}
