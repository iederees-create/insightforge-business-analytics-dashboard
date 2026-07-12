import { useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useDatasetStore } from "../../store/datasetStore";

/** Part 19: a single, always-available control to wipe in-memory data and any persisted preference. */
export function DeleteAllDataButton() {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    useDatasetStore.getState().clearAllData();
    setConfirming(false);
  };

  return (
    <>
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete all data
      </Button>
      <Modal open={confirming} onClose={() => setConfirming(false)} title="Delete all data?">
        <p className="text-sm text-text">
          This clears the imported file, column mapping, and any locally saved preferences from this browser. Nothing
          was ever uploaded anywhere, so this only affects this tab/device. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            Delete everything
          </Button>
        </div>
      </Modal>
    </>
  );
}
