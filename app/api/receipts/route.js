import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { splitReceipt } from "@/lib/receiptSplit";
import { CATEGORIES } from "@/lib/categories";

const VALID = new Set(CATEGORIES.map((c) => c.name));
const clean = (s, max = 120) => String(s ?? "").trim().slice(0, max);
const money = (n) => Math.round(Number(n) * 100) / 100;

// Saves a scanned/pasted receipt in one go:
//  - one document in `receipts` (incl. the raw OCR lines, kept as training data)
//  - one expense per category, each carrying its items and a link to the receipt
export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userEmail = session.user.email;
    const body = await request.json();

    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
    if (!date) return NextResponse.json({ error: "A valid date is required" }, { status: 400 });

    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 300).map((it) => ({
      name: clean(it.name) || "Item",
      amount: money(it.amount),
      category: VALID.has(it.category) ? it.category : "Other",
      ...(it.qty ? { qty: Number(it.qty), unit: money(it.unit), isWeight: Boolean(it.isWeight) } : {}),
      ...(it.discount ? { discount: money(it.discount) } : {}),
      ...(it.raw ? { raw: clean(it.raw, 200) } : {}),
    }));
    const total = money(body.total);
    if (!(total > 0) && !items.some((it) => it.amount > 0)) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }

    const mode = body.mode === "single" ? "single" : "split";
    const category = VALID.has(body.category) ? body.category : "Other";
    const merchant = clean(body.merchant, 60) || null;
    const groups = splitReceipt({ total, items, mode, category });

    const client = await clientPromise;
    const db = client.db("expense-tracker");
    const now = new Date();

    const receipt = {
      userEmail,
      merchant,
      date: new Date(date),
      total: money(groups.reduce((s, g) => s + g.amount, 0)),
      printedTotal: total || null,
      mode,
      items,
      source: clean(body.source, 20) || "scan",
      // Raw OCR lines: the training data for a future line-reading model
      lines: (Array.isArray(body.lines) ? body.lines : []).slice(0, 400).map((l) => clean(l, 200)),
      createdAt: now,
    };
    const { insertedId: receiptId } = await db.collection("receipts").insertOne(receipt);

    const expenses = groups.map((g) => ({
      item: merchant || (g.items.length === 1 ? g.items[0].name : "Receipt"),
      amount: money(g.amount),
      category: g.category,
      date: new Date(date),
      userEmail,
      createdAt: now,
      receiptId,
      merchant,
      items: g.items,
      ...(g.adjustment ? { adjustment: g.adjustment } : {}),
    }));
    const result = await db.collection("expenses").insertMany(expenses);
    const ids = Object.values(result.insertedIds);
    await db.collection("receipts").updateOne({ _id: receiptId }, { $set: { expenseIds: ids } });

    return NextResponse.json(
      {
        receiptId: receiptId.toString(),
        expenses: expenses.map((e, i) => ({ ...e, _id: ids[i].toString(), receiptId: receiptId.toString() })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Receipt save error:", error);
    return NextResponse.json({ error: "Failed to save receipt" }, { status: 500 });
  }
}
