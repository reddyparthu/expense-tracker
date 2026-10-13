import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";

const VALID = new Set(CATEGORIES.map((c) => c.name));

// Monthly budgets per category: { budgets: { "Food & Groceries": 300, ... } }
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const client = await clientPromise;
    const doc = await client
      .db("expense-tracker")
      .collection("budgets")
      .findOne({ userEmail: session.user.email });
    return NextResponse.json({ budgets: doc?.budgets || {} });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load budgets" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const body = await request.json();
    const budgets = {};
    for (const [category, value] of Object.entries(body?.budgets || {})) {
      const amount = Math.round(Number(value) * 100) / 100;
      if (VALID.has(category) && amount > 0 && amount < 1e7) budgets[category] = amount;
    }
    const client = await clientPromise;
    await client
      .db("expense-tracker")
      .collection("budgets")
      .updateOne(
        { userEmail: session.user.email },
        { $set: { budgets, updatedAt: new Date() }, $setOnInsert: { userEmail: session.user.email } },
        { upsert: true }
      );
    return NextResponse.json({ budgets });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save budgets" }, { status: 500 });
  }
}
