import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert to base64
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = image.type || "image/jpeg";
    const base64Image = `data:${mimeType};base64,${base64}`;

    // Call OCR.space API
    const ocrFormData = new URLSearchParams();
    ocrFormData.append("base64Image", base64Image);
    ocrFormData.append("language", "eng");
    ocrFormData.append("isTable", "true");
    ocrFormData.append("OCREngine", "2"); // Engine 2 is better for receipts
    ocrFormData.append("scale", "true");
    ocrFormData.append("detectOrientation", "true");

    const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: process.env.OCR_SPACE_API_KEY,
      },
      body: ocrFormData,
    });

    const ocrResult = await ocrResponse.json();

    if (ocrResult.IsErroredOnProcessing) {
      const errorMsg = ocrResult.ErrorMessage?.[0] || "OCR processing failed";
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // Extract text from all parsed results
    const text = ocrResult.ParsedResults
      ?.map((r) => r.ParsedText)
      .join("\n") || "";

    return NextResponse.json({ text });
  } catch (error) {
    console.error("OCR Error:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}