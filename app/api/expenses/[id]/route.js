import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const client = await clientPromise;
    const db = client.db("expense-tracker");

    await db.collection("expenses").deleteOne({
      _id: new ObjectId(id),
      userEmail: session.user.email,
    });

    return NextResponse.json({ message: "Expense deleted" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}