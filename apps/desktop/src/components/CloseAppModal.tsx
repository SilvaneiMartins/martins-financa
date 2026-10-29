import { invoke } from "@tauri-apps/api/core";
import { Power } from "lucide-react";
import { useState } from "react";
import { isTauri } from "../lib/db";
import { Button, Modal } from "./ui";

/** Confirmação para fechar a aplicação. */
export function CloseAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      if (isTauri()) await invoke("app_exit");
      else window.close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Fechar o Martins Finança?"
      icon={<Power size={18} />}
      footer={
        <>
          <Button variant="ghost" autoFocus onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>Fechar aplicação</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">
        Seus dados já estão salvos no computador. Se este computador estiver compartilhando o banco na rede local,
        os outros computadores da casa perderão o acesso enquanto o app estiver fechado.
      </p>
    </Modal>
  );
}
