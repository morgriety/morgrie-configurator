import {useState} from 'react';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';
import {AboutDialog} from './about-dialog';

const ExternalLinkContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 26px;
  flex: 0 0 auto;

  a,
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: #e0dedc;
    font: inherit;
    letter-spacing: 0;
    text-decoration: none;
    cursor: pointer;
    transition: color 140ms ease, background 140ms ease;

    &:hover {
      color: #f1eeeb;
      background: rgba(255, 255, 255, 0.04);
    }

    &:active {
      background: rgba(255, 255, 255, 0.08);
    }

    &:focus-visible {
      outline: 2px solid #e0dedc;
      outline-offset: 4px;
    }
  }

  @media (max-width: 1100px) {
    gap: 16px;
  }

  @media (max-width: 760px) {
    gap: 10px;
  }
`;

const Divider = styled.span`
  width: 1px;
  height: 26px;
  flex: 0 0 1px;
  background: rgba(255, 255, 255, 0.2);
`;

export const ExternalLinks = () => {
  const {t} = useTranslation();
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <ExternalLinkContainer>
        <a href="https://caniusevia.com/" target="_blank" rel="noreferrer">
          {t('Help')}
        </a>
        <Divider aria-hidden="true" />
        <button type="button" onClick={() => setShowAbout(true)}>
          {t('About')}
        </button>
      </ExternalLinkContainer>
      <AboutDialog isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
};