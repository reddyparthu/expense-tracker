import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("expense-tracker");
    const expenses = await db
      .collection("expenses")
      .find({ userEmail: session.user.email })
      .sort({ date: -1 })
      .toArray();

    const serialized = expenses.map((exp) => ({
      ...exp,
      _id: exp._id.toString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { item, amount, category, date } = body;

    if (!item || !amount || !category || !date) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("expense-tracker");

    const expense = {
      item,
      amount: parseFloat(amount),
      category,
      date: new Date(date),
      userEmail: session.user.email,
      createdAt: new Date(),
    };

    const result = await db.collection("expenses").insertOne(expense);

    return NextResponse.json(
      { ...expense, _id: result.insertedId.toString() },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "Failed to add expense" }, { status: 500 });
  }
}