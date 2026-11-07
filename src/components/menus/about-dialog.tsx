import {useEffect, useRef} from 'react';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const Dialog = styled.dialog`
  box-sizing: border-box;
  width: min(460px, calc(100vw - 40px));
  padding: 30px;
  border: 1px solid var(--mg-border);
  border-radius: 12px;
  background: var(--mg-editor);
  color: var(--mg-text);
  font-family: Inter, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: 0;

  &::backdrop {
    background: rgba(33, 33, 33, 0.35);
  }

  h2 {
    margin: 0 0 16px;
    font-size: 20px;
    font-weight: 500;
    line-height: 28px;
    letter-spacing: 0.5px;
  }

  p {
    margin: 0 0 20px;
    color: var(--mg-text-secondary);
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-bottom: 26px;
  }

  a {
    color: var(--mg-text);
    text-underline-offset: 3px;
  }

  button {
    min-height: 36px;
    padding: 6px 20px;
    border: 1px solid var(--mg-border);
    border-radius: 7px;
    background: var(--mg-nav-active);
    color: var(--mg-text);
    font: inherit;
    cursor: pointer;
  }
`;

export const AboutDialog = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const {t} = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && !dialog?.open) dialog?.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  return (
    <Dialog
      ref={dialogRef}
      aria-labelledby="morgrie-about-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 id="morgrie-about-title">MORGRIE Configurator</h2>
      <p>
        {t(
          'MORGRIE Configurator is built on VIA, the open-source keyboard configuration application.',
        )}
      </p>
      <nav aria-label={t('VIA resources')}>
        <a href="https://caniusevia.com/" target="_blank" rel="noreferrer">
          VIA
        </a>
        <a href="https://github.com/the-via/app" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="https://discord.gg/NStTR5YaPB" target="_blank" rel="noreferrer">
          Discord
        </a>
      </nav>
      <button type="button" onClick={onClose}>
        {t('Close')}
      </button>
    </Dialog>
  );
};