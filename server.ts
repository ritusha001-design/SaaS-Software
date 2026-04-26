import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from "stripe";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { UserOptions } from "jspdf-autotable";

interface ExtendedjsPDF extends jsPDF {
  autoTable: (options: UserOptions) => void;
  lastAutoTable: {
    finalY: number;
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // PDF Generation
  app.post("/api/invoices/pdf", async (req, res) => {
    try {
      const { invoice, org, client, items } = req.body;
      const doc = new jsPDF() as ExtendedjsPDF;
      
      // Header
      doc.setFontSize(20);
      doc.text(org.name, 20, 20);
      doc.setFontSize(10);
      doc.text(org.address || "", 20, 30);
      doc.text(`VAT ID: ${org.taxId || ""}`, 20, 35);
      
      doc.setFontSize(16);
      doc.text(`INVOICE #${invoice.invoiceNumber}`, 140, 20);
      doc.setFontSize(10);
      doc.text(`Issue Date: ${invoice.issueDate}`, 140, 30);
      doc.text(`Due Date: ${invoice.dueDate}`, 140, 35);
      
      // Client
      doc.setFontSize(12);
      doc.text("Bill To:", 20, 55);
      doc.setFontSize(10);
      doc.text(client.name, 20, 62);
      doc.text(client.address || "", 20, 68);
      
      // Items Table
      const tableData = items.map((item: { description: string; quantity: number; unitPrice: number }) => [
        item.description,
        item.quantity,
        item.unitPrice.toFixed(2),
        `${invoice.currency.toUpperCase()}`,
        (item.quantity * item.unitPrice).toFixed(2)
      ]);
      
      doc.autoTable({
        startY: 80,
        head: [['Description', 'Qty', 'Price', 'Currency', 'Total']],
        body: tableData,
      });
      
      // Totals
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.text(`Subtotal: ${invoice.subtotal.toFixed(2)}`, 140, finalY);
      doc.text(`VAT (${org.vatRate}%): ${invoice.vatTotal.toFixed(2)}`, 140, finalY + 5);
      doc.setFontSize(12);
      doc.text(`Total: ${invoice.total.toFixed(2)} ${invoice.currency.toUpperCase()}`, 140, finalY + 12);
      
      const pdfBuffer = doc.output("arraybuffer");
      res.setHeader("Content-Type", "application/pdf");
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("PDF Error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Stripe Checkout (Dummy example, would need real org configuration)
  app.post("/api/payments/create-checkout", async (req, res) => {
    try {
      const { amount, currency, invoiceId } = req.body;
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        // For demo purposes, we'll return a fake URL if key is missing
        return res.json({ url: `${process.env.APP_URL}/payment-success?invoiceId=${invoiceId}&mock=true` });
      }

      const stripe = new Stripe(stripeKey);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: currency || "gbp",
              product_data: { name: `Invoice #${invoiceId}` },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/invoices`,
      });

      res.json({ url: session.url });
    } catch {
      res.status(500).json({ error: "Stripe error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
