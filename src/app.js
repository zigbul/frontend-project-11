import * as yup from 'yup';
import i18next from './i18n';
import onChange from 'on-change';

const renderInitialText = (elements, i18n) => {
  for (let elementKey in elements) {
    elements[elementKey].textContent = i18n.t(elementKey);
  }
};

const parseRSS = (data) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(data.contents, 'application/xml');
  const parseError = doc.querySelector('parsererror');

  if (parseError) {
    throw new Error(i18next.t('parseError'));
  }

  const feedTitle = doc.querySelector('channel > title').textContent;
  const feedDescription = doc.querySelector('channel > description').textContent;
  const items = doc.querySelectorAll('item');
  const posts = Array.from(items).map((item) => ({
    title: item.querySelector('title').textContent,
    link: item.querySelector('link').textContent,
    description: item.querySelector('description').textContent,
    id: item.querySelector('guid').textContent,
  }));

  return {
    feed: {
      title: feedTitle,
      description: feedDescription,
      url: doc.querySelector('channel > link').textContent,
    },
    posts,
  };
};

const handleError = (message) => {
  const feedbackElement = document.querySelector('.feedback');
  feedbackElement.textContent = i18next.t(message);
  feedbackElement.classList.add('text-danger');
};

const resetForm = () => {
  const input = document.querySelector('#url-input');
  input.value = '';
  input.classList.remove('is-invalid');
  input.focus();
  const feedbackElement = document.querySelector('.feedback');
  feedbackElement.textContent = '';
  feedbackElement.classList.remove('text-danger');
};

const makeUrl = (userInput) => {
  const baseUrl = 'https://allorigins.hexlet.app/get?url=';
  return new URL(baseUrl + encodeURIComponent(userInput)).href;
};

export const app = () => {
  const state = {
    feeds: [],
    posts: [],
    feedPostIds: {},
    readPosts: new Set(),
  };

  const elements = {
    pageTitle: document.querySelector('title'),
    modalTitle: document.querySelector('.modal-title'),
    modalBody: document.querySelector('.modal-body'),
    readMore: document.querySelector('.modal-footer a'),
    closeButton: document.querySelector('.modal-footer button'),
    appTitle: document.querySelector('h1'),
    intro: document.querySelector('.lead'),
    urlInput: document.querySelector('.form-floating input'),
    urlInputLabel: document.querySelector('.form-floating label'),
    addButton: document.querySelector('#addButton'),
    exampleText: document.querySelector('#exampleText'),
    feedback: document.querySelector('.feedback'),
    footerText: document.querySelector('#footerText'),
    footerLink: document.querySelector('#footerText a'),
  };

  const schema = yup.object().shape({
    url: yup.string().url(i18next.t('validation.url')).required(i18next.t('validation.required')),
  });

  const checkUniqueUrl = (url) => {
    return !state.feeds.some((feed) => feed.url === url);
  };

  function createElement(tag = 'div', classList = [], text = '', children = []) {
    const element = document.createElement(tag);
    element.classList.add(...classList);
    element.textContent = text;

    if (children.length) {
      children.forEach((child) => element.append(child));
    }

    return element;
  }

  function createFeedBlock(feed) {
    const cardTitle = createElement(
      'h5',
      ['card-title'],
      i18next.t('feedTitle', { title: feed.title }),
    );
    const cardText = createElement(
      'p',
      ['card-text'],
      i18next.t('feedDescription', { description: feed.description }),
    );
    const cardBody = createElement('div', ['card-body'], null, [cardTitle, cardText]);
    const card = createElement('div', ['card', 'mb-3'], null, [cardBody]);

    return card;
  }

  function createPostsBlock(post) {
    const isPostRead = state.readPosts.has(post.id);
    const containerClassList = [
      'list-group-item',
      'd-flex',
      'justify-content-between',
      'align-items-center',
      isPostRead ? 'fw-normal' : 'fw-bold',
    ];

    const link = createElement('a', [], post.title);
    link.href = post.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const button = createElement(
      'button',
      ['btn', 'btn-primary', 'btn-sm'],
      i18next.t('previewButton'),
    );

    const container = createElement('li', containerClassList, null, [link, button]);

    return container;
  }

  const updateUI = () => {
    const feedsContainer = document.querySelector('.feeds');
    const postsContainer = document.querySelector('.posts');

    feedsContainer.innerHTML = '';

    state.feeds.forEach((feed) => {
      feedsContainer.append(createFeedBlock(feed));
    });

    postsContainer.innerHTML = '';

    state.posts.forEach((post) => {
      postsContainer.append(createPostsBlock(post));
    });
  };

  const watchedState = onChange(state, (path) => {
    if (path === 'feeds' || path === 'posts' || path === 'readPosts') {
      updateUI();
    }
  });

  i18next
    .init({
      fallbackLng: 'ru',
      debug: true,
      backend: {
        loadPath: '/locales/{{lng}}/translation.json',
      },
    })
    .then(() => {
      yup.setLocale({
        mixed: {
          required: i18next.t('validation.required'),
          notOneOf: i18next.t('validation.notOneOf'),
        },
        string: {
          url: i18next.t('validation.url'),
        },
      });

      renderInitialText(elements, i18next);

      document.querySelector('#form').addEventListener('submit', (e) => {
        e.preventDefault();

        const input = document.querySelector('#url-input');
        const url = input.value.trim();

        if (!checkUniqueUrl(url)) {
          input.classList.add('is-invalid');
          handleError('urlAlreadyExists');
          return;
        }

        schema
          .validate({ url })
          .then(() => {
            fetch(makeUrl(url))
              .then((response) => response.json())
              .then((data) => {
                const { feed, posts } = parseRSS(data);
                watchedState.feeds.push(feed);
                watchedState.posts.push(...posts);
                resetForm();
              })
              .catch(() => handleError('networkError'));
          })
          .catch((error) => {
            input.classList.add('is-invalid');
            handleError(error.message);
          });
      });

      document.querySelector('.posts').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
          const postId = e.target.getAttribute('data-post-id');
          watchedState.readPosts.add(postId);
        }
      });
    });
};
