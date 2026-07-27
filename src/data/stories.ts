import type { Story } from '../types';

// Short dialogues built (almost) entirely from course vocabulary.

export const stories: Story[] = [
  {
    id: 'meeting',
    title: 'Танилцах',
    titleEn: 'Meeting Someone',
    icon: '🤝',
    xp: 20,
    lines: [
      { sp: 'Бат', mn: 'Сайн байна уу?', ro: 'Sain baina uu?', en: 'Hello!' },
      { sp: 'Сараа', mn: 'Сайн, та сайн байна уу?', ro: 'Sain, ta sain baina uu?', en: 'Fine — and how are you?' },
      { sp: 'Бат', mn: 'Намайг Бат гэдэг. Таны нэр хэн бэ?', ro: 'Namaig Bat gedeg. Tany ner khen be?', en: 'My name is Bat. What is your name?' },
      { sp: 'Сараа', mn: 'Намайг Сараа гэдэг', ro: 'Namaig Saraa gedeg', en: 'My name is Saraa.' },
      { sp: 'Бат', mn: 'Та хаанаас ирсэн бэ?', ro: 'Ta khaanaas irsen be?', en: 'Where are you from?' },
      { sp: 'Сараа', mn: 'Би Улаанбаатараас ирсэн. Та монголоор сайн ярьдаг!', ro: 'Bi Ulaanbaataraas irsen. Ta mongoloor sain yaridag!', en: 'I am from Ulaanbaatar. You speak Mongolian well!' },
      { sp: 'Бат', mn: 'Баярлалаа. Би монгол хэл сурч байна', ro: 'Bayarlalaa. Bi mongol khel surch baina', en: 'Thank you. I am learning Mongolian.' },
    ],
    questions: [
      { q: 'What is the woman\'s name?', options: ['Saraa', 'Bat', 'Yesui'], correct: 0 },
      { q: 'Where is Saraa from?', options: ['The countryside', 'Ulaanbaatar', 'America'], correct: 1 },
      { q: 'What is Bat doing?', options: ['Selling books', 'Learning Mongolian', 'Drinking tea'], correct: 1 },
    ],
  },
  {
    id: 'teahouse',
    title: 'Цайны газар',
    titleEn: 'At the Teahouse',
    icon: '🍵',
    xp: 20,
    lines: [
      { sp: 'Сараа', mn: 'Би цай ууна. Та юу уух вэ?', ro: 'Bi tsai uuna. Ta yuu uukh ve?', en: 'I will drink tea. What will you drink?' },
      { sp: 'Бат', mn: 'Би сүүтэй цай ууна', ro: 'Bi süütei tsai uuna', en: 'I will drink milk tea.' },
      { sp: 'Сараа', mn: 'Та өлсөж байна уу?', ro: 'Ta ölsöj baina uu?', en: 'Are you hungry?' },
      { sp: 'Бат', mn: 'Тийм, би их өлсөж байна', ro: 'Tiim, bi ikh ölsöj baina', en: 'Yes, I am very hungry.' },
      { sp: 'Сараа', mn: 'Энд бууз их амттай', ro: 'End buuz ikh amttai', en: 'The buuz here are very tasty.' },
      { sp: 'Бат', mn: 'За, би бууз иднэ. Хуушуур амттай юу?', ro: 'Za, bi buuz idne. Khuushuur amttai yuu?', en: 'Okay, I will eat buuz. Is the khuushuur tasty?' },
      { sp: 'Сараа', mn: 'Тийм! Хоёулаа авъя', ro: 'Tiim! Khoyoulaa aviya', en: 'Yes! Let\'s get both.' },
      { sp: '', mn: 'Хоол амттай байсан. Бат баяртай байна', ro: 'Khool amttai baisan. Bat bayartai baina', en: 'The food was tasty. Bat is happy.' },
    ],
    questions: [
      { q: 'What does Bat drink?', options: ['Water', 'Milk tea', 'Airag'], correct: 1 },
      { q: 'How does Bat feel at the start?', options: ['Very hungry', 'Tired', 'Sick'], correct: 0 },
      { q: 'What do they order?', options: ['Only buuz', 'Buuz and khuushuur', 'Bread and milk'], correct: 1 },
    ],
  },
  {
    id: 'family-photo',
    title: 'Гэр бүлийн зураг',
    titleEn: 'The Family Photo',
    icon: '🖼️',
    xp: 20,
    lines: [
      { sp: 'Сараа', mn: 'Энэ миний гэр бүл', ro: 'Ene minii ger bül', en: 'This is my family.' },
      { sp: 'Бат', mn: 'Энэ хэн бэ?', ro: 'Ene khen be?', en: 'Who is this?' },
      { sp: 'Сараа', mn: 'Энэ миний аав. Тэр малчин', ro: 'Ene minii aav. Ter malchin', en: 'This is my father. He is a herder.' },
      { sp: 'Бат', mn: 'Танай аав хаана суудаг вэ?', ro: 'Tanai aav khaana suudag ve?', en: 'Where does your father live?' },
      { sp: 'Сараа', mn: 'Аав ээж хоёр тал нутагт суудаг', ro: 'Aav eej khoyor tal nutagt suudag', en: 'My father and mother live on the steppe.' },
      { sp: 'Бат', mn: 'Тэдэнд морь байна уу?', ro: 'Tedend mori baina uu?', en: 'Do they have horses?' },
      { sp: 'Сараа', mn: 'Тийм, олон морь, хонь, ямаа байна', ro: 'Tiim, olon mori, khoni, yamaa baina', en: 'Yes — many horses, sheep and goats.' },
      { sp: 'Бат', mn: 'Сайхан! Би тал нутагт очмоор байна', ro: 'Saikhan! Bi tal nutagt ochmoor baina', en: 'Wonderful! I want to visit the steppe.' },
    ],
    questions: [
      { q: 'What does Saraa\'s father do?', options: ['Teacher', 'Herder', 'Doctor'], correct: 1 },
      { q: 'Where do her parents live?', options: ['In Ulaanbaatar', 'On the steppe', 'Abroad'], correct: 1 },
      { q: 'Which animals do they have?', options: ['Horses, sheep, goats', 'Cats and dogs', 'Camels only'], correct: 0 },
    ],
  },
  {
    id: 'market-day',
    title: 'Захад',
    titleEn: 'At the Market',
    icon: '🛒',
    xp: 20,
    lines: [
      { sp: '', mn: 'Бямба гараг. Бат захад явна', ro: 'Byamba garag. Bat zakhad yavna', en: 'It is Saturday. Bat goes to the market.' },
      { sp: 'Бат', mn: 'Энэ малгай ямар үнэтэй вэ?', ro: 'Ene malgai yamar ünetei ve?', en: 'How much is this hat?' },
      { sp: 'Худалдагч', mn: 'Хорин мянган төгрөг', ro: 'Khorin myangan tögrög', en: 'Twenty thousand tögrög.' },
      { sp: 'Бат', mn: 'Их үнэтэй байна!', ro: 'Ikh ünetei baina!', en: 'That is very expensive!' },
      { sp: 'Худалдагч', mn: 'За, арван мянга. Хямд байна', ro: 'Za, arvan myanga. Khyamd baina', en: 'Okay, ten thousand. That is cheap.' },
      { sp: 'Бат', mn: 'За, би авна. Баярлалаа!', ro: 'Za, bi avna. Bayarlalaa!', en: 'Okay, I will take it. Thank you!' },
      { sp: '', mn: 'Одоо Батад шинэ малгай байна', ro: 'Odoo Batad shine malgai baina', en: 'Now Bat has a new hat.' },
    ],
    questions: [
      { q: 'What day is it?', options: ['Monday', 'Saturday', 'Sunday'], correct: 1 },
      { q: 'What does Bat buy?', options: ['A hat', 'Boots', 'A deel'], correct: 0 },
      { q: 'What does he pay in the end?', options: ['20,000 tögrög', '10,000 tögrög', '1,000 tögrög'], correct: 1 },
    ],
  },
];
