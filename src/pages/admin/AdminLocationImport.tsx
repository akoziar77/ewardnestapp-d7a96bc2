import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Globe, MapPin } from "lucide-react";

const CSV_TEMPLATE = `name,brand,address,city,state,zip,lat,lng
Shell Station #1234,Shell,123 Main St,Dallas,TX,75201,32.7767,-96.7970
BP Express #567,BP,456 Oak Ave,Houston,TX,77002,29.7604,-95.3698
Chevron #890,Chevron,789 Elm Blvd,Austin,TX,78701,30.2672,-97.7431
ExxonMobil #321,ExxonMobil,101 Pine Rd,San Antonio,TX,78205,29.4241,-98.4936`;

function ImportResults({ result }: { result: Record<string, unknown> }) {
  return (
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
          {[
            { label: "Total Rows", value: result.total, bg: "bg-muted/50" },
            { label: "Imported", value: result.imported, bg: "bg-green-500/10", color: "text-green-600" },
            { label: "Skipped", value: result.skipped, bg: "bg-yellow-500/10", color: "text-yellow-600" },
            { label: "Brands Matched", value: result.brands_matched, bg: "bg-muted/50" },
          ].map((s) => (
            <div key={s.label} className={`text-center p-3 rounded-lg ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color ?? ""}`}>{String(s.value ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
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
  );
}

export default function AdminLocationImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // NREL API state
  const [nrelState, setNrelState] = useState("");
  const [nrelZip, setNrelZip] = useState("");
  const [nrelRadius, setNrelRadius] = useState("25");
  const [nrelLimit, setNrelLimit] = useState("200");
  const [fetching, setFetching] = useState(false);

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
    if (f) { setFile(f); setResult(null); }
  };

  const handleFileImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const isJson = file.name.endsWith(".json");
      const { data, error } = await supabase.functions.invoke("import-gas-stations", {
        body: { sourceType: isJson ? "json" : "csv", payload: isJson ? JSON.parse(text) : text },
      });
      if (error) throw error;
      setResult(data);
      if (data?.imported > 0) toast.success(`Imported ${data.imported} locations`);
      else toast.info("No new locations imported");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleNrelFetch = async () => {
    if (!nrelState && !nrelZip) {
      toast.error("Enter a state code or ZIP code");
      return;
    }
    setFetching(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("nrel-fetch", {
        body: {
          state: nrelState || undefined,
          zip: nrelZip || undefined,
          radius: Number(nrelRadius),
          limit: Number(nrelLimit),
        },
      });
      if (error) throw error;
      setResult(data);
      if (data?.imported > 0) toast.success(`Imported ${data.imported} locations from NREL`);
      else toast.info(data?.message || "No new locations imported");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "NREL fetch failed");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <p className="text-sm text-muted-foreground">
        Bulk import brand locations from a CSV/JSON file or fetch automatically from the NREL fuel station database.
      </p>

      <Tabs defaultValue="api" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> API Fetch
          </TabsTrigger>
          <TabsTrigger value="file" className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> File Upload
          </TabsTrigger>
        </TabsList>

        {/* API Fetch Tab */}
        <TabsContent value="api" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                NREL Fuel Station Locator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fetch gas and fuel station locations from the U.S. Department of Energy database. Stations are automatically matched to your existing Gas category brands.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nrel-state">State Code</Label>
                  <Input id="nrel-state" placeholder="TX" maxLength={2} value={nrelState}
                    onChange={(e) => setNrelState(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nrel-zip">ZIP Code</Label>
                  <Input id="nrel-zip" placeholder="75201" maxLength={5} value={nrelZip}
                    onChange={(e) => setNrelZip(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nrel-radius">Radius (miles)</Label>
                  <Input id="nrel-radius" type="number" min={1} max={100} value={nrelRadius}
                    onChange={(e) => setNrelRadius(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nrel-limit">Max Results</Label>
                  <Input id="nrel-limit" type="number" min={1} max={200} value={nrelLimit}
                    onChange={(e) => setNrelLimit(e.target.value)} />
                </div>
              </div>

              <Button className="w-full" disabled={fetching} onClick={handleNrelFetch}>
                {fetching ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fetching…</>
                ) : (
                  <><Globe className="h-4 w-4 mr-2" /> Fetch Stations</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Upload Tab */}
        <TabsContent value="file" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" /> CSV Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Required columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">name, brand, address, city, state, zip, lat, lng</code>
              </p>
              <div className="bg-muted/50 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre">{CSV_TEMPLATE}</pre>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Download Template
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" /> Upload File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileChange} />
                {file ? (
                  <div className="space-y-1">
                    <FileSpreadsheet className="h-8 w-8 mx-auto text-primary" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select a CSV or JSON file</p>
                  </div>
                )}
              </div>
              <Button className="w-full" disabled={!file || importing} onClick={handleFileImport}>
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Import Locations</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result && <ImportResults result={result} />}
    </div>
  );
}
