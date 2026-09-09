import { useEffect, useRef } from 'react';

/**
 * Intercepta o botão nativo "Voltar" do celular (Android / PWA popstate)
 * para fechar o modal aberto ao invés de fechar o aplicativo.
 */
export function useModalBackButton(
  isOpen: boolean,
  onClose: () => void,
  modalName: string = 'modal'
) {
  const isPoppingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const stateKey = `modal_${modalName}_${Date.now()}`;
    window.history.pushState({ isModal: true, modalKey: stateKey }, '');

    const handlePopState = () => {
      isPoppingRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Se o modal foi fechado por ação interna (botão X, salvar, cancelar) e não pelo popstate nativo
      if (!isPoppingRef.current && window.history.state?.isModal) {
        try {
          window.history.back();
        } catch {
          // Silencioso se histórico não puder retroceder
        }
      }
      isPoppingRef.current = false;
    };
  }, [isOpen, modalName]);
}
