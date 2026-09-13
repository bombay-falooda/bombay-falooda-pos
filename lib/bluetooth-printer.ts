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

  solidLine() {
    this.line("________________________________________________");
    return this;
  }

  dashedLine() {
    this.line("------------------------------------------------");
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
  customerPhone?: string
): Uint8Array {
  const encoder = new EscPosEncoder();
  encoder.init();

  // Date and Time
  const now = new Date();
  const dateStr = `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  encoder.alignCenter().bold(false).textSize(1, 1).line(dateStr);

  // KOT Header (Centered, bold)
  encoder.alignCenter().bold(true).textSize(2, 2).line(`KOT - ${kotNumber.replace("KOT-", "")}`);
  const ordTypeLabel = orderType.toUpperCase() === "DINE_IN" ? "Dine In" : orderType.toUpperCase() === "PICK_UP" || orderType.toUpperCase() === "TAKEAWAY" ? "Pick Up" : orderType;
  encoder.textSize(1, 2).line(ordTypeLabel);

  // Customer if provided
  if (customerName || customerPhone) {
    encoder.textSize(1, 1).bold(false).alignLeft();
    const cust = customerName ? `Customer: ${customerName}` : "";
    const ph = customerPhone ? ` (${customerPhone})` : "";
    encoder.line(`${cust}${ph}`);
  }

  // Solid Divider
  encoder.textSize(1, 1).bold(false).alignLeft().solidLine();

  // Table Header (48 cols: No.Item 28 cols, Special Note 12 cols, Qty. 8 cols)
  encoder.bold(true).line("No.Item".padEnd(28, " ") + "Special   ".padEnd(12, " ") + "Qty.".padStart(8, " "));
  encoder.line(" ".padEnd(28, " ") + "Note      ".padEnd(12, " ") + "    ".padStart(8, " "));
  encoder.solidLine();

  // Items
  items.forEach((item, idx) => {
    const numPrefix = `${idx + 1}  `;
    const wrappedName = wrapWords(item.name, 23);
    const qtyStr = item.quantity.toString().padStart(8, " ");
    const noteStr = (item.notes || "--").padEnd(12, " ").substring(0, 12);

    // First line
    encoder.bold(true).line(`${numPrefix}${wrappedName[0].padEnd(25, " ")}${noteStr}${qtyStr}`);

    // Subsequent wrapped lines indented
    for (let i = 1; i < wrappedName.length; i++) {
      encoder.bold(true).line(`   ${wrappedName[i]}`);
    }

    // Add-ons if present
    if (item.addons && item.addons.length > 0) {
      item.addons.forEach((addon) => {
        const addonName = typeof addon === "string" ? addon : addon.name;
        const wrappedAddon = wrapWords(`  + Add-on: ${addonName}`, 44);
        wrappedAddon.forEach((l) => encoder.bold(false).line(l));
      });
    }

    if (item.notes) {
      encoder.bold(false).line(`  * Note: ${item.notes}`);
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
  discountAmount?: number
): Uint8Array {
  const encoder = new EscPosEncoder();
  encoder.init();

  // 1. Header (Centered, bold outlet name, address & phone)
  encoder.alignCenter().bold(true).textSize(1, 2).line(outletName || "Bombay Falooda");
  encoder.textSize(1, 1).bold(false);

  if (outletAddress) {
    const wrappedAddr = wrapWords(outletAddress, 42);
    wrappedAddr.forEach((line) => encoder.line(line));
  }
  if (phone) {
    encoder.line(`M. ${phone}`);
  }
  encoder.solidLine();

  // 2. Details Block (48 cols)
  encoder.alignLeft().bold(false);
  if (customerName || customerPhone) {
    const cust = customerName ? `Name: ${customerName}` : "";
    const ph = customerPhone ? ` (${customerPhone})` : "";
    encoder.line(`${cust}${ph}`);
  }

  const now = new Date();
  const dateStr = `Date: ${now.toLocaleDateString("en-GB")}`.padEnd(24, " ");
  const timeStr = `Time: ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`.padStart(24, " ");
  encoder.line(`${dateStr}${timeStr}`);

  const ordTypeLabel = orderType.toUpperCase() === "DINE_IN" ? "Dine In" : orderType.toUpperCase() === "PICK_UP" || orderType.toUpperCase() === "TAKEAWAY" ? "Pick Up" : orderType;
  const ordStr = `Order: ${ordTypeLabel}`.padEnd(24, " ");
  const billNoClean = billNumber.replace("BILL-", "").replace("INV-", "");
  const billStr = `Bill No. : ${billNoClean}`.padStart(24, " ");
  encoder.line(`${ordStr}${billStr}`);

  const cashierStr = `Cashier: ${cashierName || "biller"}`.padEnd(24, " ");
  const tokenClean = tokenNumber.replace("KOT-", "").replace("TOKEN-", "");
  const tokenStr = `Token No.: ${tokenClean}`.padStart(24, " ");
  encoder.line(`${cashierStr}${tokenStr}`);
  encoder.solidLine();

  // 3. Table Header (48 cols: No.Item 26, Qty. 6, Price 8, Amount 8)
  encoder.bold(true).line("No.Item".padEnd(26, " ") + "Qty.".padStart(6, " ") + "Price".padStart(8, " ") + "Amount".padStart(8, " "));
  encoder.solidLine();

  // 4. Items with multi-line word wrapping and add-ons
  let totalQty = 0;
  let subTotal = 0;

  items.forEach((item, idx) => {
    totalQty += Number(item.quantity || 1);
    const lineTotal = Number(item.total || (item.unitPrice * item.quantity));
    subTotal += lineTotal;

    const numPrefix = `${idx + 1}  `;
    const wrappedName = wrapWords(item.name, 21);
    const qtyStr = item.quantity.toString().padStart(6, " ");
    const priceStr = item.unitPrice.toFixed(2).padStart(8, " ");
    const amountStr = lineTotal.toFixed(2).padStart(8, " ");

    // First line
    encoder.bold(false).line(`${numPrefix}${wrappedName[0].padEnd(22, " ")}${qtyStr}${priceStr}${amountStr}`);

    // Subsequent lines indented
    for (let i = 1; i < wrappedName.length; i++) {
      encoder.line(`   ${wrappedName[i]}`);
    }

    // Addons if present
    if (item.addons && item.addons.length > 0) {
      item.addons.forEach((addon) => {
        const addonName = typeof addon === "string" ? addon : addon.name;
        const addonPrice = typeof addon === "object" && addon.price ? ` (+Rs ${addon.price.toFixed(2)})` : "";
        const wrappedAddon = wrapWords(`   + ${addonName}${addonPrice}`, 44);
        wrappedAddon.forEach((l) => encoder.line(l));
      });
    }
  });

  encoder.solidLine();

  // 5. Totals Block
  const totalQtyStr = `Total Qty: ${totalQty}`.padEnd(24, " ");
  const subTotalStr = `Sub Total  ${subTotal.toFixed(2)}`.padStart(24, " ");
  encoder.line(`${totalQtyStr}${subTotalStr}`);

  if (discountAmount && discountAmount > 0) {
    const discStr = `Discount  ${discountAmount.toFixed(2)}`.padStart(48, " ");
    encoder.line(discStr);
  }

  encoder.solidLine();

  // 6. Grand Total (Clean double-height, perfectly proportioned)
  encoder.alignCenter().bold(true).textSize(1, 2).line(`Grand Total: Rs ${totalAmount.toFixed(2)}`);
  encoder.textSize(1, 1).bold(false).solidLine();

  // 7. Footer
  encoder.alignCenter().bold(true).line("Thank You Visit Again");
  encoder.bold(false).line('"Please wait for 10 minutes after ordering."');
  encoder.cut();

  return encoder.encode();
}
