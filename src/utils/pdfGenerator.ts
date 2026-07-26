import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

export interface CertificateData {
  certificateId: string;
  studentName: string;
  courseName: string;
  teacherName: string;
  issuedAt: Date;
  verificationCode: string;
}

export const generateCertificatePDF = async (data: CertificateData): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        layout: "landscape",
        size: "A4",
      });

      const buffers: Buffer[] = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Border & Header
      doc
        .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
        .strokeColor("#9333ea")
        .lineWidth(4)
        .stroke();

      doc.fillColor("#0f172a").fontSize(32).text("EDUCORE ACADEMY", { align: "center" });
      doc.moveDown(0.5);

      doc.fillColor("#9333ea").fontSize(24).text("CERTIFICATE OF COMPLETION", { align: "center" });
      doc.moveDown(1);

      doc.fillColor("#64748b").fontSize(14).text("This is to certify that", { align: "center" });
      doc.moveDown(0.5);

      doc.fillColor("#0f172a").fontSize(26).text(data.studentName.toUpperCase(), { align: "center" });
      doc.moveDown(0.5);

      doc.fillColor("#64748b").fontSize(14).text("has successfully completed the course", { align: "center" });
      doc.moveDown(0.5);

      doc.fillColor("#4f46e5").fontSize(20).text(`"${data.courseName}"`, { align: "center" });
      doc.moveDown(1);

      doc.fillColor("#64748b").fontSize(12).text(`Instructor: ${data.teacherName}`, { align: "center" });
      doc.text(`Date Issued: ${new Date(data.issuedAt).toLocaleDateString()}`, { align: "center" });
      doc.text(`Certificate ID: ${data.certificateId}`, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
