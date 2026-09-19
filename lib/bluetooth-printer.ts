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
    this.buffer.push(0x1b, 0x40); // ESC @ (Reset)
    this.buffer.push(0x1b, 0x21, 0x00); // ESC ! 0 (Standard Character Mode - Normal Font)
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
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00); // ESC E (Emphasized)
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

  solidLine() {
    this.bold(false).line("________________________________________________");
    return this;
  }

  dashedLine() {
    this.bold(false).line("------------------------------------------------");
    return this;
  }

  feed(lines: number = 5) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  cut() {
    this.feed(5);
    this.buffer.push(0x1d, 0x56, 0x00); // GS V 0 (Cut paper)
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

function wrapWords(text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [text];
}

export function buildEscPosKotReceipt(
  kotNumber: string,
  orderType: string,
  items: Array<{ name: string; quantity: number; notes?: string; addons?: Array<{ name: string; price?: number }> }>,
  customerName?: string,
  customerPhone?: string,
  billNote?: string,
  customerEmail?: string
): Uint8Array {
  const encoder = new EscPosEncoder();
  encoder.init();

  // Header
  encoder.alignCenter();
  encoder.line(new Date().toLocaleDateString("en-GB") + "   " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  encoder.bold(true).line(`KOT - ${kotNumber.replace("KOT-", "")}`);
  const ordTypeLabel = orderType.toUpperCase() === "DINE_IN" ? "Dine In" : orderType.toUpperCase() === "PICK_UP" || orderType.toUpperCase() === "TAKEAWAY" ? "Pick Up" : orderType;
  encoder.line(`Order: ${ordTypeLabel}`);
  encoder.bold(false);

  if (customerName || customerPhone || customerEmail) {
    encoder.alignLeft();
    const cust = customerName ? `Customer: ${customerName}` : "";
    const ph = customerPhone ? ` (${customerPhone})` : "";
    if (cust || ph) encoder.bold(true).line(`${cust}${ph}`).bold(false);
    if (customerEmail) encoder.line(`Email: ${customerEmail}`);
  }

  if (billNote) {
    encoder.alignLeft().bold(true).line(`Note: ${billNote}`).bold(false);
  }

  encoder.alignLeft().solidLine();

  // Table Header (48 cols: Item Name 28, Note 14, Qty 6)
  encoder.bold(true).line("No. Item Name".padEnd(28, " ") + "Special Note".padEnd(14, " ") + "Qty".padStart(6, " "));
  encoder.bold(false).solidLine();

  // Items
  items.forEach((item, idx) => {
    const numPrefix = `${idx + 1}. `.padEnd(3, " ");
    const wrappedName = wrapWords(item.name, 23);
    const qtyStr = item.quantity.toString().padStart(6, " ");
    const noteStr = (item.notes || "--").padEnd(14, " ").substring(0, 14);

    // First line
    encoder.bold(true).line(`${numPrefix}${wrappedName[0].padEnd(25, " ")}${noteStr}${qtyStr}`);
    encoder.bold(false);

    // Subsequent wrapped lines
    for (let i = 1; i < wrappedName.length; i++) {
      encoder.line(`   ${wrappedName[i]}`);
    }

    // Addons
    if (item.addons && item.addons.length > 0) {
      item.addons.forEach((addon) => {
        const addonName = typeof addon === "string" ? addon : addon.name;
        const wrappedAddon = wrapWords(`+ ${addonName}`, 25);
        wrappedAddon.forEach((l) => encoder.line(`   ${l}`));
      });
    }

    if (item.notes) {
      encoder.line(`   * Note: ${item.notes}`);
    }
  });

  encoder.solidLine();
  encoder.cut();
  return encoder.encode();
}

export function buildEscPosBillReceipt(
  outletName: string,
  outletAddress: string,
  billNumber: string,
  tokenNumber: string,
  orderType: string,
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number; notes?: string; addons?: Array<{ name: string; price?: number }> }>,
  totalAmount: number,
  phone?: string,
  cashierName?: string,
  customerName?: string,
  customerPhone?: string,
  discountAmount?: number,
  customerEmail?: string,
  billNote?: string,
  deliveryAddress?: string,
  driverName?: string,
  deliveryPaymentType?: "COD" | "PAID"
): Uint8Array {
  const encoder = new EscPosEncoder();
  encoder.init();

  // 1. Header (Centered, clean standard font)
  encoder.alignCenter().bold(true).line(outletName ? outletName.toUpperCase() : "BOMBAY FALOODA");
  encoder.bold(false);

  if (outletAddress) {
    const wrappedAddr = wrapWords(outletAddress, 42);
    wrappedAddr.forEach((line) => encoder.line(line));
  }
  if (phone) {
    encoder.line(`Ph: ${phone}`);
  }
  encoder.solidLine();

  // 2. Info Block (48 cols)
  encoder.alignLeft();
  if (customerName || customerPhone || customerEmail) {
    const cust = customerName ? `Customer: ${customerName}` : "";
    const ph = customerPhone ? ` (${customerPhone})` : "";
    if (cust || ph) encoder.bold(true).line(`${cust}${ph}`).bold(false);
    if (customerEmail) encoder.line(`Email: ${customerEmail}`);
  }

  const now = new Date();
  const dateStr = `Date: ${now.toLocaleDateString("en-GB")}`.padEnd(24, " ");
  const timeStr = `Time: ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`.padStart(24, " ");
  encoder.line(`${dateStr}${timeStr}`);

  const billNoClean = billNumber.replace("BILL-", "").replace("INV-", "");
  const billStr = `Bill No: ${billNoClean}`.padEnd(24, " ");
  const isDelivery = orderType.toUpperCase() === "DELIVERY";
  const ordTypeLabel = orderType.toUpperCase() === "DINE_IN" ? "Dine In" : orderType.toUpperCase() === "PICK_UP" || orderType.toUpperCase() === "TAKEAWAY" ? "Pick Up" : isDelivery ? "Delivery" : orderType;
  const ordStr = `Order: ${ordTypeLabel}`.padStart(24, " ");
  encoder.bold(true).line(`${billStr}${ordStr}`).bold(false);

  const tokenClean = tokenNumber.replace("KOT-", "").replace("TOKEN-", "");
  const tokenStr = `Token No: ${tokenClean}`.padEnd(24, " ");
  const cashierStr = `Cashier: ${cashierName || "biller"}`.padStart(24, " ");
  encoder.bold(true).line(`${tokenStr}${cashierStr}`).bold(false);

  if (isDelivery || deliveryAddress || driverName) {
    if (driverName) {
      encoder.bold(true).line(`Rider: ${driverName}`).bold(false);
    }
    if (deliveryPaymentType) {
      const payText = deliveryPaymentType === "PAID" ? "PREPAID (PAID)" : `COD (COLLECT: Rs. ${totalAmount.toFixed(2)})`;
      encoder.bold(true).line(`Payment: ${payText}`).bold(false);
    }
    if (deliveryAddress) {
      encoder.bold(true).line("Delivery Address:").bold(false);
      wrapWords(deliveryAddress, 44).forEach((l) => encoder.line(`  ${l}`));
    }
  }

  if (billNote) {
    encoder.bold(true).line(`Note: ${billNote}`).bold(false);
  }

  encoder.solidLine();

  // 3. Table Header (48 cols: Item Name 28, Qty 6, Amount 14)
  encoder.bold(true).line("Item Name".padEnd(28, " ") + "Qty".padStart(6, " ") + "Amount".padStart(14, " "));
  encoder.bold(false).solidLine();

  // 4. Items Table
  let totalQty = 0;
  let subTotal = 0;

  items.forEach((item, idx) => {
    totalQty += Number(item.quantity || 1);
    const lineTotal = Number(item.total || (item.unitPrice * item.quantity));
    subTotal += lineTotal;

    const wrappedName = wrapWords(item.name, 26);
    const qtyStr = item.quantity.toString().padStart(6, " ");
    const amountStr = lineTotal.toFixed(2).padStart(14, " ");

    // First line with item name and amount
    encoder.bold(true).line(`${wrappedName[0].padEnd(28, " ")}${qtyStr}${amountStr}`);
    encoder.bold(false);

    // Subsequent wrapped lines
    for (let i = 1; i < wrappedName.length; i++) {
      encoder.line(`  ${wrappedName[i]}`);
    }

    // Addons strictly under item name
    if (item.addons && item.addons.length > 0) {
      item.addons.forEach((addon) => {
        const addonName = typeof addon === "string" ? addon : addon.name;
        const addonPrice = typeof addon === "object" && addon.price ? ` (+Rs ${addon.price.toFixed(2)})` : "";
        const fullAddonText = `+ ${addonName}${addonPrice}`;
        const wrappedAddon = wrapWords(fullAddonText, 25);
        wrappedAddon.forEach((l) => encoder.line(`  ${l}`));
      });
    }
  });

  encoder.solidLine();

  // 5. Totals & Discount Breakdown
  const disc = Number(discountAmount || 0);
  encoder.line(`Total Qty: ${totalQty}`.padEnd(24, " ") + `Sub Total: Rs ${subTotal.toFixed(2)}`.padStart(24, " "));
  if (disc > 0) {
    encoder.line("".padEnd(24, " ") + `Discount: -Rs ${disc.toFixed(2)}`.padStart(24, " "));
  }
  encoder.solidLine();

  // 6. Grand Total (Prominent, centered, clean standard font)
  encoder.alignCenter().bold(true).line(`Grand Total: Rs ${Number(totalAmount).toFixed(2)}`);
  encoder.bold(false).solidLine();

  // 7. Footer
  encoder.alignCenter().bold(true).line("Thank You! Please Visit Again");
  encoder.bold(false).line("Please wait for 10 minutes after ordering.");
  encoder.cut();

  return encoder.encode();
}
