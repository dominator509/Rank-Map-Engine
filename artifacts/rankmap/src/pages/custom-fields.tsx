import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomField {
  id: number;
  entityType: string;
  name: string;
  slug: string;
  fieldType: string;
  options?: string[];
  isRequired: boolean;
}

const ENTITY_TYPES = ["project", "keyword", "client"];
const FIELD_TYPES = ["text", "number", "select", "date", "boolean"];

export default function CustomFields() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState("project");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);

  const { data: fields = [], isLoading } = useQuery<CustomField[]>({
    queryKey: ["/api/custom-fields", entityType],
    queryFn: () => customFetch(`/api/custom-fields?entityType=${entityType}`),
  });

  const create = useMutation({
    mutationFn: () =>
      customFetch("/api/custom-fields", {
        method: "POST",
        body: JSON.stringify({ entityType, name, slug, fieldType, isRequired }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      setName("");
      setSlug("");
      setFieldType("text");
      setIsRequired(false);
      toast({ title: "Custom field created" });
    },
    onError: (e: Error) =>
      toast({ title: e.message || "Failed to create field", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => customFetch(`/api/custom-fields/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Field deleted" });
    },
  });

  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-7 h-7" />
            Custom Fields
          </h1>
          <p className="text-muted-foreground mt-1">
            Extend projects, keywords, and clients with custom metadata
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add New Field</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Entity Type</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Field Name</Label>
                <Input
                  placeholder="e.g. Target URL"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) setSlug(autoSlug(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  placeholder="target_url"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={isRequired} onCheckedChange={setIsRequired} id="required" />
                <Label htmlFor="required">Required</Label>
              </div>
              <Button onClick={() => create.mutate()} disabled={!name || !slug || create.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fields for {entityType}</CardTitle>
            <CardDescription>
              Custom metadata fields attached to {entityType} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              {ENTITY_TYPES.map((t) => (
                <Button
                  key={t}
                  variant={entityType === t ? "default" : "outline"}
                  size="sm"
                  className="capitalize"
                  onClick={() => setEntityType(t)}
                >
                  {t}
                </Button>
              ))}
            </div>

            {isLoading ? (
              <div className="h-20 bg-muted rounded animate-pulse" />
            ) : (fields as CustomField[]).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No custom fields for {entityType} yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fields as CustomField[]).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{f.slug}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {f.fieldType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {f.isRequired ? (
                          <Badge>Required</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Optional</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => remove.mutate(f.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
