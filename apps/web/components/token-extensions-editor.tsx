"use client";

import * as React from "react";
import {
  KeyValue,
  KeyValueAdd,
  KeyValueItem,
  KeyValueKeyInput,
  KeyValueList,
  KeyValueRemove,
  KeyValueValueInput,
  type KeyValueItemData,
} from "@/components/ui/key-value";
import type { TokenExtensions } from "@/lib/tokens/token-metadata";
import {
  extensionsToKeyValueItems,
  keyValueItemsToExtensions,
} from "@/lib/tokens/token-metadata";

export function TokenExtensionsEditor({
  value,
  onChange,
}: {
  value?: TokenExtensions;
  onChange: (value: TokenExtensions | undefined) => void;
}) {
  const [items, setItems] = React.useState<KeyValueItemData[]>(() =>
    extensionsToKeyValueItems(value),
  );

  return (
    <KeyValue
      value={items}
      onValueChange={(nextItems) => {
        setItems(nextItems);
        onChange(keyValueItemsToExtensions(nextItems));
      }}
      enablePaste
      keyPlaceholder="Key"
      valuePlaceholder="Value"
      className="space-y-3"
    >
      <KeyValueList>
        <KeyValueItem className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] items-center gap-2">
          <KeyValueKeyInput className="min-w-0 font-mono text-sm" />
          <KeyValueValueInput className="h-9 min-h-9 w-full min-w-0 field-sizing-fixed font-mono text-sm" />
          <KeyValueRemove variant="ghost" size="icon-sm" className="mt-0.5 shrink-0" />
        </KeyValueItem>
      </KeyValueList>
      <KeyValueAdd variant="outline" size="sm">
        Add extension
      </KeyValueAdd>
    </KeyValue>
  );
}
