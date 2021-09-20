import { useState, useEffect } from 'react';
import { useKeyPressEvent } from 'react-use';
import { Box, Text, Message } from '@navch-ui/core';
import { makeStyles } from '@navch-ui/styles';

type VerificationCodePaneProps = {
  initialValue?: string;
  onSubmit?: (code: string) => unknown;
};

const noop = () => {};

const CodeSize = 6; // number of chars
const CodeRegex = new RegExp(`^\\d{${CodeSize}}$`);

const CodeBox: React.FC<{ char?: string; autoFocus?: boolean }> = props => {
  const { char = '', autoFocus } = props;
  const { styles, css } = useStyles();
  return (
    <Box fluid flex m={2} align="center" justify="center" border="emphasis" style={{ width: 42, height: 42 }}>
      <input
        type="tel"
        className={css(styles.codePane_input)}
        autoFocus={autoFocus}
        value={char}
        onChange={noop}
      />
    </Box>
  );
};

export function VerificationCodePane(props: VerificationCodePaneProps) {
  const { initialValue, onSubmit } = props;

  const [code, setCode] = useState<string[]>([]);
  const isCodeFilled = code.length === CodeSize;

  const isNumberKey = (e: KeyboardEvent) => !!e.key.match(/\d/);
  useKeyPressEvent(isNumberKey, event => {
    if (isCodeFilled) return;
    setCode(prev => [...prev, event.key]);
  });

  useKeyPressEvent('Backspace', () => {
    setCode(prev => prev.slice(0, prev.length - 1));
  });

  // auto-fill code when specified
  useEffect(() => {
    if (!initialValue || !CodeRegex.test(initialValue)) return;
    setCode(initialValue.substr(0, CodeSize).split(''));
  }, [initialValue]);

  // auto-submit code when ready
  useEffect(() => {
    if (!isCodeFilled) return;
    if (onSubmit) onSubmit(code.join(''));
  }, [isCodeFilled]);

  return (
    <Box style={{ width: 350 }}>
      <Box padded>
        <Text pv={2} bold>
          Your Verification Code
        </Text>
        <Text pt={2} variant="subtitle1" muted>
          Please enter the verification code to claim your certificate.
        </Text>
      </Box>

      <Box flex padded pv={6}>
        <Box fluid flex mr={3}>
          <CodeBox char={code[0]} autoFocus={true} />
          <CodeBox char={code[1]} />
          <CodeBox char={code[2]} />
        </Box>

        <Box fluid flex ml={3}>
          <CodeBox char={code[3]} />
          <CodeBox char={code[4]} />
          <CodeBox char={code[5]} />
        </Box>
      </Box>

      <Message kind="info" filled title="What is this?">
        <Text variant="subtitle1" muted>
          {`You've requested to claim your certificate, the content will `}
          {`be generated based on the code you entered above.`}
        </Text>
      </Message>
    </Box>
  );
}

export const useStyles = makeStyles(theme => ({
  codePane_input: {
    ...theme.font.h6,
    outline: 'none',
    border: 'none',
    boxShadow: 'none',
    textAlign: 'center',
    color: theme.color.text.base,
    caretColor: 'transparent',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
}));
