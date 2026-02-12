"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteUnpaidOrderAction } from "@/app/(app)/books/actions";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();

  function deleteOrder() {
    startDeleteTransition(async () => {
      const result = await deleteUnpaidOrderAction(orderId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Order deleted");
      router.refresh();
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this unpaid order?</DialogTitle>
          <DialogDescription>
            This removes the unpaid test order from your account list.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={deleteOrder} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
