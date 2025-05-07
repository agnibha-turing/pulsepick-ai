
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterChipsProps {
  filters: string[];
  activeFilters: string[];
  onFilterChange: (filter: string) => void;
}

export function FilterChips({ 
  filters, 
  activeFilters, 
  onFilterChange 
}: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(filter => (
        <Button
          key={filter}
          variant="outline"
          size="sm"
          className={cn(
            "rounded-full transition-all",
            activeFilters.includes(filter) 
              ? "bg-primary text-primary-foreground border-primary" 
              : "hover:bg-secondary"
          )}
          onClick={() => onFilterChange(filter)}
        >
          {filter}
        </Button>
      ))}
    </div>
  );
}
