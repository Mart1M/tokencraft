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

function serializeExtensions(extensions?: TokenExtensions) {
  if (!extensions) {
    return "";
  }

  return JSON.stringify(
    Object.entries(extensions).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function TokenExtensionsEditor({
  value,
  onChange,
}: {
  value?: TokenExtensions;
  onChange: (value: TokenExtensions | undefined) => void;
}) {
  const serializedValue = serializeExtensions(value);
  const [items, setItems] = React.useState<KeyValueItemData[]>(() =>
    extensionsToKeyValueItems(value),
  );

  React.useEffect(() => {
    setItems(extensionsToKeyValueItems(value));
  }, [serializedValue]);

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
        <KeyValueItem className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2">
          <KeyValueKeyInput className="font-mono text-sm" />
          <KeyValueValueInput className="font-mono text-sm" />
          <KeyValueRemove variant="ghost" size="icon-sm" className="mt-0.5 shrink-0" />
        </KeyValueItem>
      </KeyValueList>
      <KeyValueAdd variant="outline" size="sm">
        Add extension
      </KeyValueAdd>
    </KeyValue>
  );
}
