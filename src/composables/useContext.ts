import { ref } from "vue";

export function useContext() {
  const contextText = ref<string | null>(null);

  function setContext(text: string | null) {
    contextText.value = text;
  }

  function clear() {
    contextText.value = null;
  }

  return { contextText, setContext, clear };
}
