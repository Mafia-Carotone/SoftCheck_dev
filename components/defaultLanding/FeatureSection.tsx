import { useTranslation } from 'next-i18next';

const FeatureSection = () => {
  const { t } = useTranslation('common');
  return (
    <section className="py-6 lg:py-12 px-2">
      <div className="flex flex-col justify-center space-y-6">
        <h2 className="text-center text-4xl font-bold normal-case">
          {t('Demo')}
        </h2>
        <p className="text-center text-xl">
          Watch the demo and see how easy software management can be!
        </p>
        
        {/* YouTube Video Embed */}
        <div className="flex justify-center my-6">
          <iframe
            width="640"
            height="360"
            src="https://www.youtube.com/embed/9Ax85FI81ds?start=912"
            title="Software Management Demo (Coming soon!)"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;