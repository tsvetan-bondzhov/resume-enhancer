import type { CertificationItemDto } from "@/types/api"

interface CertificationsSectionRendererProps {
  items: CertificationItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function CertificationsSectionRenderer({
  items,
  onFieldChange,
}: CertificationsSectionRendererProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="text-sm">
          {item.name != null && (
            <p className="font-medium">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "name", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit name"
                >
                  {item.name}
                </span>
              ) : (
                <span>{item.name}</span>
              )}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {item.issuer != null && (
              <>
                {onFieldChange ? (
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "issuer", e.currentTarget.textContent ?? "")
                    }
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit issuer"
                  >
                    {item.issuer}
                  </span>
                ) : (
                  <span>{item.issuer}</span>
                )}
                {" · "}
              </>
            )}
            {onFieldChange ? (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  onFieldChange(item.id, "issueDate", e.currentTarget.textContent ?? "")
                }
                className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                aria-label="Edit issueDate"
              >
                {item.issueDate ?? ""}
              </span>
            ) : (
              item.issueDate != null && <span>{item.issueDate}</span>
            )}
            {(item.issueDate != null || onFieldChange) && " — "}
            {onFieldChange ? (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  onFieldChange(item.id, "expirationDate", e.currentTarget.textContent ?? "")
                }
                className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                aria-label="Edit expirationDate"
              >
                {item.expirationDate ?? "No expiry"}
              </span>
            ) : (
              <span>{item.expirationDate ?? "No expiry"}</span>
            )}
          </p>
        </div>
      ))}
    </div>
  )
}
