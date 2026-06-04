import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';

interface LeadNotificationProps {
  clientName: string;
  formName: string;
  payload: Record<string, any>;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    font_family?: string;
  };
}

export const LeadNotificationEmail = ({
  clientName = 'Client',
  formName = 'Contact Form',
  payload = {},
  branding = {},
}: LeadNotificationProps) => {
  const primaryColor = branding.primary_color || '#0F766E'; // Default teal
  const fontFamily = branding.font_family || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  return (
    <Html>
      <Head />
      <Preview>Nouveau lead via {formName} - {clientName}</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '0 auto', padding: '20px 0 48px', marginBottom: '64px' }}>
          
          {/* Dynamic Logo Header */}
          <Section style={{ padding: '20px 48px', backgroundColor: primaryColor, textAlign: 'center' }}>
            {branding.logo_url ? (
              <Img src={branding.logo_url} width="150" alt={clientName} style={{ margin: '0 auto' }} />
            ) : (
              <Heading style={{ color: '#ffffff', fontSize: '24px', margin: 0 }}>{clientName}</Heading>
            )}
          </Section>

          <Section style={{ padding: '0 48px' }}>
            <Heading style={{ fontSize: '20px', color: '#333', marginTop: '24px' }}>
              Nouveau message reçu : {formName}
            </Heading>
            <Text style={{ color: '#555', fontSize: '16px', lineHeight: '24px' }}>
              Vous avez reçu une nouvelle soumission depuis votre site web. Voici les détails :
            </Text>

            <Hr style={{ borderColor: '#e6ebf1', margin: '20px 0' }} />

            <Section style={{ backgroundColor: '#f9fbfd', padding: '16px', borderRadius: '8px' }}>
              {Object.entries(payload).map(([key, value]) => {
                // Formatting keys nicely (e.g., "first_name" -> "First Name")
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                return (
                  <Text key={key} style={{ margin: '8px 0', color: '#333', fontSize: '15px' }}>
                    <strong style={{ color: primaryColor }}>{formattedKey}:</strong> {String(value)}
                  </Text>
                );
              })}
            </Section>

            <Hr style={{ borderColor: '#e6ebf1', margin: '20px 0' }} />

            <Text style={{ color: '#8898aa', fontSize: '12px', textAlign: 'center' }}>
              Cet email a été envoyé automatiquement par le service mwcrea Forms.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default LeadNotificationEmail;
