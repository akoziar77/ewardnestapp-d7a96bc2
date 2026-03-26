import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const CSV_TEMPLATE = `name,brand,address,city,state,zip,lat,lng
Shell Station #1234,Shell,123 Main St,Dallas,TX,75201,32.7767,-96.7970
BP Express #567,BP,456 Oak Ave,Houston,TX,77002,29.7604,-95.3698
Chevron #890,Chevron,789 Elm Blvd,Austin,TX,78701,30.2672,-97.7431
ExxonMobil #321,ExxonMobil,101 Pine Rd,San Antonio,TX,78205,29.4241,-98.4936`;

export default function AdminLocationImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gas_stations_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const isJson = file.name.endsWith(".json");

      const { data, error } = await supabase.functions.invoke("import-gas-stations", {
        body: {
          sourceType: isJson ? "json" : "csv",
          payload: isJson ? JSON.parse(text) : text,
        },
      });

      if (error) throw error;
      setResult(data);

      if (data?.imported > 0) {
        toast.success(`Imported ${data.imported} locations`);
      } else {
        toast.info("No new locations imported");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Bulk import brand locations from a CSV or JSON file. Locations are matched to existing brands by name.
        </p>
      </div>

      {/* Template Download */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            CSV Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download the template CSV with the required columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">name, brand, address, city, state, zip, lat, lng</code>
          </p>
          <div className="bg-muted/50 rounded-lg p-3 overflow-x-auto">
            <pre className="text-xs text-muted-foreground whitespace-pre">
{CSV_TEMPLATE}
            </pre>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="space-y-1">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select a CSV or JSON file
                </p>
              </div>
            )}
          </div>

          <Button
            className="w-full"
            disabled={!file || importing}
            onClick={handleImport}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Locations
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {(result.imported as number) > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{String(result.total ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <p className="text-2xl font-bold text-green-600">{String(result.imported ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                <p className="text-2xl font-bold text-yellow-600">{String(result.skipped ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{String(result.brands_matched ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Brands Matched</p>
              </div>
            </div>

            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Errors:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {(result.errors as string[]).map((err, i) => (
                    <Badge key={i} variant="outline" className="text-xs block w-fit text-destructive border-destructive/30">
                      {err}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
