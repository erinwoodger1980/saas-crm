import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MonthlyData = {
  year: number;
  month: number;
  monthName: string;
  enquiries: number;
  quotesCount: number;
  quotesValue: number;
  salesCount: number;
  salesValue: number;
  conversionRate: number;
};

type WeeklyData = {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  enquiries: number;
  quotesCount: number;
  quotesValue: number;
  salesCount: number;
  salesValue: number;
  conversionRate: number;
};

type TargetsBreakdown = {
  monthly: {
    enquiriesTarget: number;
    quotesValueTarget: number;
    quotesCountTarget: number;
    salesValueTarget: number;
    salesCountTarget: number;
  };
  weekly: {
    enquiriesTarget: number;
    quotesValueTarget: number;
    quotesCountTarget: number;
    salesValueTarget: number;
    salesCountTarget: number;
  };
};

type MatrixColumn = {
  key: string;
  label: string;
  isCurrent?: boolean;
};

type MatrixRow = {
  key: string;
  label: string;
  format: "count" | "currency" | "percent";
  values: Array<number | null>;
  target?: number | null;
};

type SalesPerformanceMatrixProps = {
  mode: "monthly" | "weekly";
  monthlyData: MonthlyData[];
  weeklyData: WeeklyData[];
  targetsBreakdown: TargetsBreakdown;
  currentMonth?: { year: number; month: number } | null;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
};

const toMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export function buildSalesPerformanceMatrix(
  mode: "monthly" | "weekly",
  monthlyData: MonthlyData[],
  weeklyData: WeeklyData[],
  targets: TargetsBreakdown,
  currentMonth?: { year: number; month: number } | null
) {
  const columns: MatrixColumn[] = (mode === "weekly" ? weeklyData : monthlyData).map((item) => {
    if (mode === "weekly") {
      const week = item as WeeklyData;
      return {
        key: week.weekStart,
        label: week.weekLabel,
        isCurrent: false,
      };
    }
    const month = item as MonthlyData;
    return {
      key: toMonthKey(month.year, month.month),
      label: month.monthName,
      isCurrent: !!currentMonth && month.year === currentMonth.year && month.month === currentMonth.month,
    };
  });

  const data = mode === "weekly" ? weeklyData : monthlyData;
  const targetsForMode = mode === "weekly" ? targets.weekly : targets.monthly;
  const conversionTarget = targetsForMode.enquiriesTarget > 0
    ? targetsForMode.salesCountTarget / targetsForMode.enquiriesTarget
    : null;

  const rows: MatrixRow[] = [
    {
      key: "enquiries",
      label: "Enquiries",
      format: "count",
      values: data.map((d) => d.enquiries),
      target: targetsForMode.enquiriesTarget,
    },
    {
      key: "quotesValue",
      label: "Quotes Value",
      format: "currency",
      values: data.map((d) => d.quotesValue),
      target: targetsForMode.quotesValueTarget,
    },
    {
      key: "quotesCount",
      label: "Quotes Count",
      format: "count",
      values: data.map((d) => d.quotesCount),
      target: targetsForMode.quotesCountTarget,
    },
    {
      key: "salesCount",
      label: "Conversions",
      format: "count",
      values: data.map((d) => d.salesCount),
      target: targetsForMode.salesCountTarget,
    },
    {
      key: "salesValue",
      label: "Conversion Value",
      format: "currency",
      values: data.map((d) => d.salesValue),
      target: targetsForMode.salesValueTarget,
    },
    {
      key: "conversionRate",
      label: "Conversion Rate",
      format: "percent",
      values: data.map((d) => d.conversionRate),
      target: conversionTarget,
    },
    {
      key: "targetEnquiries",
      label: "Target: Enquiries",
      format: "count",
      values: data.map(() => targetsForMode.enquiriesTarget),
      target: targetsForMode.enquiriesTarget,
    },
    {
      key: "targetQuotesValue",
      label: "Target: Quotes Value",
      format: "currency",
      values: data.map(() => targetsForMode.quotesValueTarget),
      target: targetsForMode.quotesValueTarget,
    },
    {
      key: "targetQuotesCount",
      label: "Target: Quotes Count",
      format: "count",
      values: data.map(() => targetsForMode.quotesCountTarget),
      target: targetsForMode.quotesCountTarget,
    },
    {
      key: "targetSalesValue",
      label: "Target: Sales Value",
      format: "currency",
      values: data.map(() => targetsForMode.salesValueTarget),
      target: targetsForMode.salesValueTarget,
    },
    {
      key: "targetSalesCount",
      label: "Target: Sales Count",
      format: "count",
      values: data.map(() => targetsForMode.salesCountTarget),
      target: targetsForMode.salesCountTarget,
    },
  ];

  return { columns, rows, conversionTarget };
}

export function SalesPerformanceMatrix({
  mode,
  monthlyData,
  weeklyData,
  targetsBreakdown,
  currentMonth,
  formatCurrency,
  formatPercent,
}: SalesPerformanceMatrixProps) {
  const { columns, rows, conversionTarget } = buildSalesPerformanceMatrix(
    mode,
    monthlyData,
    weeklyData,
    targetsBreakdown,
    currentMonth
  );

  const formatValue = (value: number | null, format: MatrixRow["format"]) => {
    if (value == null) return "—";
    if (format === "currency") return formatCurrency(value);
    if (format === "percent") return formatPercent(value);
    return Math.round(value).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sales Performance Matrix</CardTitle>
        <p className="text-sm text-slate-600">Time across columns, metrics down rows</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-left font-medium">Metric</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`sticky top-0 z-10 px-3 py-2 text-right font-medium whitespace-nowrap ${
                      col.isCurrent ? "bg-blue-50 text-blue-700" : "bg-slate-50"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">
                    {row.label}
                  </td>
                  {row.values.map((value, idx) => {
                    const isConversion = row.key === "conversionRate";
                    const meetsTarget =
                      isConversion && conversionTarget != null && value != null
                        ? value >= conversionTarget
                        : row.target != null && value != null
                          ? value >= row.target
                          : null;
                    const cellTone =
                      isConversion && meetsTarget != null
                        ? meetsTarget
                          ? "text-emerald-700"
                          : "text-amber-700"
                        : "text-slate-800";

                    return (
                      <td
                        key={`${row.key}-${columns[idx]?.key || idx}`}
                        className={`px-3 py-2 text-right ${cellTone} ${
                          columns[idx]?.isCurrent ? "bg-blue-50" : ""
                        }`}
                      >
                        {formatValue(value, row.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}