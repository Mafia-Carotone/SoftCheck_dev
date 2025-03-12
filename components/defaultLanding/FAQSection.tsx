import { useTranslation } from 'next-i18next';
import { Card } from 'react-daisyui';
import { QuestionMarkCircleIcon } from '@heroicons/react/20/solid';

import faqs from './data/faq.json';

const FAQSection = () => {
  const { t } = useTranslation('common');
  return (
    <section className="py-12">
      <div className="flex flex-col justify-center space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold tracking-tight">
            {t('frequently-asked')}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Got questions? We've got answers. Check out our FAQs to learn more.
          </p>
        </div>
        
        <div className="max-w-2xl mx-auto w-full space-y-6 pt-8">
          {faqs.map((faq, index) => (
            <div key={`faq-${index}`}>
              <Card 
                className="
                  h-full transform transition-all duration-200 hover:scale-105
                  border-gray-200 dark:border-gray-700 shadow-xl
                  rounded-2xl bg-base-100
                "
              >
                <Card.Body className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <QuestionMarkCircleIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Card.Title tag="h3" className="text-xl font-semibold mb-2">
                        {faq.question}
                      </Card.Title>
                      <p className="text-gray-600 dark:text-gray-300">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
