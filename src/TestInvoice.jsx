import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function TestInvoice() {
  const [result, setResult] = useState("Checking...");

  useEffect(() => {
    async function test() {
      const { data, error } = await supabase
        .from("sales")
        .select("invoice_no");

      if (error) {
        setResult("ERROR: " + error.message);
        return;
      }

      setResult(JSON.stringify(data));
    }

    test();
  }, []);

  return <pre>{result}</pre>;
}

export default TestInvoice;
