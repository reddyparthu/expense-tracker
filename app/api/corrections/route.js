import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { normalizeKey } from "@/lib/categoryModel";

const VALID = new Set(CATEGORIES.map((c) => c.name));

// The user's remembered fixes: raw receipt text → the name/category they chose.
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const client = await clientPromise;
    const db = client.db("expense-tracker");
    const rows = await db
      .collection("corrections")
      .find({ userEmail: session.user.email }, { projection: { _id: 0, key: 1, raw: 1, name: 1, category: 1 } })
      .sort({ updatedAt: -1 })
      .limit(5000)
      .toArray();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load corrections" }, { status: 500 });
  }
}

// Body: { corrections: [{ raw, name, category }] }
export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userEmail = session.user.email;
    const { corrections } = await request.json();
    const ops = (Array.isArray(corrections) ? corrections : [])
      .slice(0, 300)
      .map((c) => ({
        key: normalizeKey(c.raw).slice(0, 120),
        raw: String(c.raw || "").slice(0, 200),
        name: String(c.name || "").trim().slice(0, 120),
        category: VALID.has(c.category) ? c.category : null,
      }))
      .filter((c) => c.key.length >= 2 && (c.name || c.category))
      .map((c) => ({
        updateOne: {
          filter: { userEmail, key: c.key },
          update: {
            $set: { raw: c.raw, name: c.name, category: c.category, updatedAt: new Date() },
            $inc: { count: 1 },
            $setOnInsert: { userEmail, key: c.key, createdAt: new Date() },
          },
          upsert: true,
        },
      }));
    if (!ops.length) return NextResponse.json({ saved: 0 });

    const client = await clientPromise;
    const db = client.db("expense-tracker");
    await db.collection("corrections").bulkWrite(ops, { ordered: false });
    return NextResponse.json({ saved: ops.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save corrections" }, { status: 500 });
  }
}
