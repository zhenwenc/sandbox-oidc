import { useState, useEffect } from 'react';
import { useKeyPressEvent } from 'react-use';
import { Box, Text, Message } from '@navch-ui/core';

type VerificationCodePaneProps = {
  initialValue?: string;
  onSubmit?: (code: string) => unknown;
};

const CodeSize = 6; // number of chars
const CodeRegex = new RegExp(`^\\d{${CodeSize}}$`);

function CodeBox(props: { char?: string }) {
  const { char = '' } = props;
  return (
    <Box fluid flex m={2} border="emphasis" justify="center" align="center" style={{ height: 42 }}>
      <Text variant="h6">{char}</Text>
    </Box>
  );
}

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
          <CodeBox char={code[0]} />
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
