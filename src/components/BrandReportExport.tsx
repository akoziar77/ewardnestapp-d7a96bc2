import { useState } from "react";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  Download,
  FileText,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";

interface BrandReportExportProps {
  brandId: string;
  brandName?: string;
}

export default function BrandReportExport({
  brandId,
  brandName,
}: BrandReportExportProps) {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState<"pdf" | "csv" | null>(null);
  const { toast } = useToast();

  async function fetchReport() {
    const { data, error } = await supabase.functions.invoke(
      "brand-receipt-insights",
      {
        body: {
          action: "full_report",
          brand_id: brandId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
      }
    );
    if (error) throw error;
    return data;
  }

  async function handleExportCSV() {
    setLoading("csv");
    try {
      const report = await fetchReport();
      const name = report.brand?.name ?? brandName ?? "Brand";
      const lines: string[] = [];

      // Summary
      lines.push("RewardsNest Brand Report");
      lines.push(`Brand,${name}`);
      lines.push(
        `Period,${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`
      );
      lines.push("");
      lines.push("Metric,Value");
      lines.push(`Total Spend,$${report.summary.total_spend}`);
      lines.push(`Receipt Count,${report.summary.receipt_count}`);
      lines.push(`Approved Receipts,${report.summary.approved_count}`);
      lines.push(`Average Basket,$${report.summary.avg_basket}`);
      lines.push(`Points Awarded,${report.summary.total_points_awarded}`);
      lines.push(`Unique Customers,${report.summary.unique_customers}`);

      // Products
      lines.push("");
      lines.push("Top Products");
      lines.push("Product,Category,Quantity Sold,Revenue");
      for (const p of report.top_products ?? []) {
        lines.push(
          `"${p.name}","${p.category ?? ""}",${p.quantity_sold},$${p.revenue}`
        );
      }

      // Customers
      lines.push("");
      lines.push("Top Customers");
      lines.push("User ID,Receipt Count,Total Spend");
      for (const c of report.top_customers ?? []) {
        lines.push(`${c.user_id},${c.receipt_count},$${c.total_spend}`);
      }

      // Timeseries
      lines.push("");
      lines.push("Daily Spend");
      lines.push("Date,Spend,Receipt Count");
      for (const t of report.timeseries ?? []) {
        lines.push(`${t.date},$${t.spend},${t.receipt_count}`);
      }

      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      downloadBlob(
        blob,
        `${name.replace(/\s+/g, "_")}_report_${format(startDate, "yyyyMMdd")}-${format(endDate, "yyyyMMdd")}.csv`
      );
      toast({ title: "CSV exported" });
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  async function handleExportPDF() {
    setLoading("pdf");
    try {
      const report = await fetchReport();
      const name = report.brand?.name ?? brandName ?? "Brand";

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("RewardsNest Brand Report", 14, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(
        `${name}  •  ${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`,
        14,
        y
      );
      doc.setTextColor(0);
      y += 12;

      // Summary table
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", 14, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Spend", `$${report.summary.total_spend.toLocaleString()}`],
          ["Receipts", `${report.summary.receipt_count}`],
          ["Approved", `${report.summary.approved_count}`],
          ["Avg Basket", `$${report.summary.avg_basket}`],
          ["Points Awarded", `${report.summary.total_points_awarded.toLocaleString()}`],
          ["Unique Customers", `${report.summary.unique_customers}`],
        ],
        theme: "grid",
        headStyles: { fillColor: [61, 122, 117] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 10 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Top Products
      if ((report.top_products ?? []).length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Top Products", 14, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          head: [["Product", "Category", "Qty Sold", "Revenue"]],
          body: report.top_products.slice(0, 20).map((p: any) => [
            p.name,
            p.category ?? "—",
            p.quantity_sold,
            `$${p.revenue.toLocaleString()}`,
          ]),
          theme: "grid",
          headStyles: { fillColor: [61, 122, 117] },
          margin: { left: 14, right: 14 },
          styles: { fontSize: 9 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Top Customers
      if ((report.top_customers ?? []).length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Top Customers", 14, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          head: [["Customer ID", "Receipts", "Spend"]],
          body: report.top_customers.slice(0, 15).map((c: any) => [
            c.user_id.slice(0, 12) + "…",
            c.receipt_count,
            `$${c.total_spend.toLocaleString()}`,
          ]),
          theme: "grid",
          headStyles: { fillColor: [61, 122, 117] },
          margin: { left: 14, right: 14 },
          styles: { fontSize: 9 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Daily Spend
      if ((report.timeseries ?? []).length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Daily Spend", 14, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          head: [["Date", "Spend", "Receipts"]],
          body: report.timeseries.map((t: any) => [
            t.date,
            `$${t.spend.toLocaleString()}`,
            t.receipt_count,
          ]),
          theme: "grid",
          headStyles: { fillColor: [61, 122, 117] },
          margin: { left: 14, right: 14 },
          styles: { fontSize: 9 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Generated by RewardsNest • Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      doc.save(
        `${name.replace(/\s+/g, "_")}_report_${format(startDate, "yyyyMMdd")}-${format(endDate, "yyyyMMdd")}.pdf`
      );
      toast({ title: "PDF exported" });
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Start date */}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">From</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {format(startDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(d) => d && setStartDate(d)}
              disabled={(d) => d > endDate || d > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* End date */}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">To</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {format(endDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(d) => d && setEndDate(d)}
              disabled={(d) => d < startDate || d > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Export buttons */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        disabled={!!loading}
        className="gap-1.5"
      >
        {loading === "pdf" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
        disabled={!!loading}
        className="gap-1.5"
      >
        {loading === "csv" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5" />
        )}
        CSV
      </Button>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
