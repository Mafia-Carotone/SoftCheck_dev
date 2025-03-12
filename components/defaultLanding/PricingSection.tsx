import { CheckIcon, SparklesIcon } from '@heroicons/react/20/solid';
import { useTranslation } from 'next-i18next';
import { Button, Card } from 'react-daisyui';

import plans from './data/pricing.json';

const PricingSection = () => {
  const { t } = useTranslation('common');
  return (
    <section className="py-12">
      <div className="flex flex-col justify-center space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold tracking-tight">
            {t('pricing')}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Choose the perfect plan for your team and streamline software requests effortlessly.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6 pt-8">
          {plans.map((plan, index) => {
            const isPopular = plan.description === "Pro";
            return (
              <div key={`plan-${index}`} className={`relative ${isPopular ? 'lg:-mt-8 lg:mb-8' : ''}`}>
                <Card 
                  className={`
                    h-full transform transition-all duration-200 hover:scale-105
                    ${isPopular ? 'border-primary shadow-2xl dark:border-primary' : 'border-gray-200 dark:border-gray-700 shadow-xl'}
                    rounded-2xl bg-base-100
                  `}
                >
                  <Card.Body className="p-6 flex flex-col h-full">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Card.Title tag="h2" className="text-2xl font-bold">
                          {plan.description}
                        </Card.Title>
                        {isPopular && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold text-primary bg-primary/10 rounded-full">
                            <SparklesIcon className="h-4 w-4" />
                            Most Popular
                          </span>
                        )}
                      </div>
                      <div className="mb-4">
                        <span className="text-4xl font-bold">{plan.amount}</span>
                        <span className="text-gray-600 dark:text-gray-300 ml-2">/ {plan.duration}</span>
                      </div>
                      <div className="mt-8 space-y-4">
                        {plan.benefits.map((benefit: string, itemIndex: number) => (
                          <div
                            key={`plan-${index}-benefit-${itemIndex}`}
                            className="flex items-start gap-3"
                          >
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <CheckIcon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-gray-600 dark:text-gray-300">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-8">
                      <Button
                        color={isPopular ? "primary" : "ghost"}
                        className={`w-full py-4 rounded-xl font-semibold text-white ${
                          isPopular ? 'shadow-lg hover:shadow-primary/50' : 'border-2'
                        }`}
                        size="lg"
                      >
                        {t('get-started')}
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
