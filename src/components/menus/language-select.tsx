import {useEffect, useRef, useState} from 'react';
import {HeaderChevron} from './header-icons';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const LANGUAGES = [
  {code: 'en', label: 'English'},
  {code: 'zh', label: '中文'},
  {code: 'ko', label: '한국어'},
  {code: 'ja', label: '日本語'},
  {code: 'es', label: 'Español'},
  {code: 'de', label: 'Deutsch'},
];

const Container = styled.div`
  position: relative;
  flex: 0 0 auto;
`;

const Trigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-width: 50px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #e0dedc;
  font: inherit;
  letter-spacing: 0;
  cursor: pointer;
  transition: color 140ms ease, background 140ms ease;

  &:hover,
  &[aria-expanded="true"] {
    color: #f1eeeb;
    background: rgba(255, 255, 255, 0.04);
  }

  &:active {
    background: rgba(255, 255, 255, 0.08);
  }

  &&:focus-visible {
    outline: 2px solid #e0dedc;
    outline-offset: 4px;
  }
`;

const LanguageList = styled.div`
  position: absolute;
  top: 47px;
  right: 0;
  z-index: 2;
  box-sizing: border-box;
  width: 166px;
  max-height: calc(100vh - 90px);
  overflow-y: auto;
  padding: 5px;
  border: 1px solid var(--mg-border);
  border-radius: 9px;
  background: var(--mg-editor);
  box-shadow: 0 6px 18px rgba(33, 33, 33, 0.1);
`;

const LanguageButton = styled.button<{$selected: boolean}>`
  display: block;
  width: 100%;
  padding: 8px 11px;
  border: 0;
  border-radius: 5px;
  background: ${(p) => (p.$selected ? 'var(--mg-nav-active)' : 'transparent')};
  color: var(--mg-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: ${(p) => (p.$selected ? 600 : 400)};
  line-height: 22px;
  letter-spacing: 0;
  text-align: left;
  cursor: pointer;

  transition: background 140ms ease;

  &:hover,
  &:active {
    background: var(--mg-nav-active);
  }

  &&:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: -2px;
  }
`;

export const LanguageSelect = () => {
  const {t, i18n} = useTranslation();
  const [showList, setShowList] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedLanguage = i18n.resolvedLanguage || i18n.language;

  useEffect(() => {
    if (!showList) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowList(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowList(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showList]);

  return (
    <Container ref={containerRef}>
      <Trigger
        ref={triggerRef}
        type="button"
        aria-label={t('Language')}
        aria-expanded={showList}
        aria-controls="morgrie-language-options"
        onClick={() => setShowList((open) => !open)}
      >
        {(selectedLanguage || 'en').split('-')[0].toUpperCase()}
        <HeaderChevron />
      </Trigger>
      {showList && (
        <LanguageList id="morgrie-language-options" aria-label={t('Language')}>
          {LANGUAGES.map(({code, label}) => (
            <LanguageButton
              key={code}
              type="button"
              lang={code}
              $selected={!!selectedLanguage?.startsWith(code)}
              aria-pressed={!!selectedLanguage?.startsWith(code)}
              onClick={() => {
                i18n.changeLanguage(code);
                setShowList(false);
                triggerRef.current?.focus();
              }}
            >
              {label}
            </LanguageButton>
          ))}
        </LanguageList>
      )}
    </Container>
  );
};
