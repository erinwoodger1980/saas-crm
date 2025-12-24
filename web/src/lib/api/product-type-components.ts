import { apiFetch } from "@/lib/api";

export type ProductTypeComponentAssignment = {
  id: string;
  tenantId: string;
  productTypeId: string;
  componentId: string;
  isRequired: boolean;
  isDefault: boolean;
  sortOrder: number;
  quantityFormula?: string | null;
  metadata?: any;
  component?: any;
};

export async function getAssignedComponents(productTypeId: string) {
  return apiFetch<ProductTypeComponentAssignment[]>(`/product-type-components/${encodeURIComponent(productTypeId)}`);
}

export async function getAvailableComponents(productTypeId: string, params: { componentType?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.componentType) query.set('componentType', params.componentType);
  if (params.search) query.set('search', params.search);
  return apiFetch<any[]>(`/product-type-components/${encodeURIComponent(productTypeId)}/available?${query.toString()}`);
}

export async function assignComponent(productTypeId: string, componentId: string, options: Partial<Omit<ProductTypeComponentAssignment, 'id' | 'tenantId' | 'productTypeId' | 'componentId'>> = {}) {
  return apiFetch<ProductTypeComponentAssignment>(`/product-type-components/${encodeURIComponent(productTypeId)}/assign`, {
    method: 'POST',
    json: { componentId, ...options }
  });
}

export async function updateAssignment(assignmentId: string, data: Partial<Omit<ProductTypeComponentAssignment, 'id' | 'tenantId' | 'productTypeId' | 'componentId'>>) {
  return apiFetch<ProductTypeComponentAssignment>(`/product-type-components/${encodeURIComponent(assignmentId)}`, {
    method: 'PATCH',
    json: data
  });
}

export async function deleteAssignment(assignmentId: string) {
  return apiFetch<{ ok: boolean }>(`/product-type-components/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE'
  });
}
